import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { AuthorizationError, requireAuth } from "@/lib/authorization";
import { loadDecisionRoomContext } from "@/lib/decision-room/context";
import { decisionRoomResponseSchema } from "@/lib/decision-room/schema";
import { buildDecisionRoomPrompt, decisionRoomSystemPrompt } from "@/lib/decision-room/prompt";
import { z } from "zod";

const decisionRoomRequestSchema = z.object({
  siteId: z.string().min(1),
  projectId: z.string().min(1),
  question: z.string().trim().min(1),
});

// Anthropic Messages API (Fable 5.1). Called with native fetch; no SDK.
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MAX_TOKENS = 4096;
const PROVIDER_TIMEOUT_MS = 180_000;

type AnthropicResponse = {
  id?: unknown;
  model?: unknown;
  stop_reason?: unknown;
  error?: {
    type?: unknown;
    message?: unknown;
  };
  content?: Array<{ type?: unknown; text?: unknown }>;
};

function safeModelContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const blocks = (payload as AnthropicResponse).content;
  if (!Array.isArray(blocks)) return null;
  const text = blocks
    .filter((block) => block && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
    .trim();
  if (!text) return null;
  return text;
}

async function requestDecisionRoomResponse(question: string, context: Awaited<ReturnType<typeof loadDecisionRoomContext>>, requestId: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-fable-5-1";
  if (!apiKey) throw new Error("ANTHROPIC_NOT_CONFIGURED");
  if (!context) throw new Error("DECISION_ROOM_CONTEXT_NOT_FOUND");

  const requestStartedAt = Date.now();
  const deadlineAt = requestStartedAt + PROVIDER_TIMEOUT_MS;
  let attemptDeadlineAt = requestStartedAt + PROVIDER_TIMEOUT_MS / 2;
  let controller = new AbortController();
  let timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS / 2);

  const prepareRetry = () => {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) return false;
    clearTimeout(timeout);
    controller = new AbortController();
    attemptDeadlineAt = deadlineAt;
    timeout = setTimeout(() => controller.abort(), remainingMs);
    return true;
  };

  const readResponseJson = async (response: Response): Promise<unknown> => {
    const bodyReadTimeoutMs = Math.max(0, attemptDeadlineAt - Date.now());
    type BodyReadResult =
      | { kind: "value"; value: unknown }
      | { kind: "error"; error: unknown }
      | { kind: "timeout" };

    let bodyTimeout: ReturnType<typeof setTimeout> | undefined;
    const bodyRead = response.json().then<BodyReadResult, BodyReadResult>(
      (value) => ({ kind: "value", value }),
      (error) => ({ kind: "error", error }),
    );
    const bodyTimeoutPromise = new Promise<BodyReadResult>((resolve) => {
      bodyTimeout = setTimeout(() => {
        clearTimeout(timeout);
        controller.abort();
        resolve({ kind: "timeout" });
      }, bodyReadTimeoutMs);
    });

    try {
      const result = await Promise.race([bodyRead, bodyTimeoutPromise]);
      if (result.kind === "timeout") {
        throw new Error("PROVIDER_BODY_READ_TIMEOUT");
      }
      if (result.kind === "error") {
        throw result.error;
      }
      return result.value;
    } finally {
      if (bodyTimeout) clearTimeout(bodyTimeout);
    }
  };

  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const response = await fetch(ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: ANTHROPIC_MAX_TOKENS,
          system: decisionRoomSystemPrompt,
          messages: [
            { role: "user", content: buildDecisionRoomPrompt(question, context) },
          ],
        }),
        signal: controller.signal,
      });

      console.error("Decision Room Anthropic HTTP response:", JSON.stringify({
        requestId,
        httpStatus: response.status,
        ok: response.ok,
        attempt,
      }));

      if (!response.ok) {
        let providerError: AnthropicResponse | undefined;
        try {
          providerError = (await response.json()) as AnthropicResponse;
        } catch {
          providerError = undefined;
        }
        console.error("Decision Room Anthropic error body:", JSON.stringify({
          requestId,
          httpStatus: response.status,
          providerErrorType: typeof providerError?.error?.type === "string" ? providerError.error.type : undefined,
          providerErrorMessage: typeof providerError?.error?.message === "string" ? providerError.error.message : undefined,
        }));
        const error = new Error(`PROVIDER_HTTP_${response.status}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      let payload: AnthropicResponse;
      const responseBodyReadStartedAt = Date.now();
      console.error("Decision Room Anthropic response-body read started:", JSON.stringify({ requestId }));
      try {
        payload = (await readResponseJson(response)) as AnthropicResponse;
        console.error("Decision Room Anthropic response-body read completed:", JSON.stringify({
          requestId,
          elapsedMs: Date.now() - responseBodyReadStartedAt,
          attempt,
        }));
      } catch (error) {
        console.error("Decision Room Anthropic response-body read failed:", JSON.stringify({
          requestId,
          error: error instanceof Error ? error.message : "unknown error",
          elapsedMs: Date.now() - responseBodyReadStartedAt,
          attempt,
        }));
        console.error("Decision Room Anthropic response-body parsing failed:", JSON.stringify({
          requestId,
          error: error instanceof Error ? error.message : "unknown error",
        }));
        const remainingMs = deadlineAt - Date.now();
        if (controller.signal.aborted && attempt === 1 && remainingMs > 0 && prepareRetry()) {
          console.error("Decision Room Anthropic body-read timeout recovery:", JSON.stringify({
            requestId,
            attempt,
            timeoutMs: PROVIDER_TIMEOUT_MS,
            elapsedMs: Date.now() - requestStartedAt,
            retrying: true,
            remainingMs,
          }));
          continue;
        }
        throw error;
      }

      // Anthropic reports completion via stop_reason ("end_turn", "max_tokens", ...).
      const finishReason = typeof payload.stop_reason === "string" ? payload.stop_reason : undefined;
      const content = safeModelContent(payload);
      const hasProviderError = Boolean(payload.error && typeof payload.error === "object");
      const unusableContent = !content;
      console.error("Decision Room Anthropic response metadata:", JSON.stringify({
        requestId,
        httpStatus: response.status,
        id: typeof payload.id === "string" ? payload.id : undefined,
        model: typeof payload.model === "string" ? payload.model : undefined,
        contentBlocks: Array.isArray(payload.content) ? payload.content.length : 0,
        stopReason: finishReason,
        hasProviderError,
        providerErrorType: typeof payload.error?.type === "string" ? payload.error.type : undefined,
        providerErrorMessage: typeof payload.error?.message === "string" ? payload.error.message : undefined,
      }));
      console.error("Decision Room control flow: after safeModelContent", JSON.stringify({
        requestId,
        usableContent: Boolean(content),
        contentType: typeof content,
        attempt,
      }));

      const shouldRetry = attempt === 1 && (finishReason === "error" || hasProviderError || unusableContent);
      if (shouldRetry) {
        console.error("Decision Room Anthropic retrying unusable HTTP-200 response:", JSON.stringify({
          requestId,
          attempt,
          nextAttempt: 2,
          finishReason,
          hasProviderError,
          unusableContent,
        }));
        if (prepareRetry()) continue;
        throw new Error("PROVIDER_EMPTY_RESPONSE");
      }

      if (!content) {
        const blocks = Array.isArray(payload.content) ? payload.content : [];
        console.error("Decision Room Anthropic empty-content structure:", JSON.stringify({
          requestId,
          contentIsArray: Array.isArray(payload.content),
          contentBlocks: blocks.length,
          blockTypes: blocks.map((block) => (block && typeof block.type === "string" ? block.type : typeof block)),
          firstBlockHasText: Boolean(blocks[0] && typeof blocks[0].text === "string"),
          stopReason: finishReason,
          attempt,
        }));
        throw new Error("PROVIDER_EMPTY_RESPONSE");
      }

      let parsed: unknown;
      try {
        console.error("Decision Room control flow: before JSON.parse:", JSON.stringify({ requestId }));
        parsed = JSON.parse(content);
        console.error("Decision Room control flow: JSON.parse succeeded:", JSON.stringify({ requestId }));
      } catch {
        console.error("Decision Room temporary invalid JSON model content:", JSON.stringify({ requestId, content }));
        if (attempt === 1) {
          console.error("Decision Room Anthropic retrying invalid JSON HTTP-200 response:", JSON.stringify({
            requestId,
            attempt,
            nextAttempt: 2,
          }));
          if (prepareRetry()) continue;
          throw new Error("PROVIDER_INVALID_JSON");
        }
        throw new Error("PROVIDER_INVALID_JSON");
      }

      console.error("Decision Room control flow: before Zod validation:", JSON.stringify({ requestId }));
      const validated = decisionRoomResponseSchema.safeParse(parsed);
      if (!validated.success) {
        console.error("Decision Room PROVIDER_INVALID_CONTRACT parsed model content:", JSON.stringify({ requestId, parsed }));
        console.error("Decision Room PROVIDER_INVALID_CONTRACT zod issues:", JSON.stringify({ requestId, issues: validated.error.issues }));
        throw new Error("PROVIDER_INVALID_CONTRACT");
      }
      console.error("Decision Room control flow: Zod validation succeeded:", JSON.stringify({ requestId }));
      return validated.data;
    }

    throw new Error("PROVIDER_EMPTY_RESPONSE");
  } catch (error) {
    if (controller.signal.aborted) {
      console.error("Decision Room Anthropic request timed out or was aborted:", JSON.stringify({
        requestId,
        timeoutMs: PROVIDER_TIMEOUT_MS,
        elapsedMs: Date.now() - requestStartedAt,
      }));
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  console.error("Decision Room route entry:", JSON.stringify({ requestId }));
  try {
    const user = await requireAuth();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }
    const input = decisionRoomRequestSchema.safeParse(body);
    if (!input.success) return NextResponse.json({ error: "siteId, projectId, and a non-empty question are required" }, { status: 400 });
    const { siteId, projectId, question } = input.data;
    if (!mongoose.isValidObjectId(siteId) || !mongoose.isValidObjectId(projectId)) return NextResponse.json({ error: "siteId and projectId must be valid identifiers" }, { status: 400 });
    await connectDB();
    const context = await loadDecisionRoomContext({ userEmail: user.email, siteId, projectId });
    if (!context) return NextResponse.json({ error: "Site or project not found" }, { status: 404 });
    try {
      const result = await requestDecisionRoomResponse(question, context, requestId);
      console.error("Decision Room control flow: before successful API response:", JSON.stringify({ requestId }));
      return NextResponse.json(result);
    } catch (error) {
      const status = error instanceof Error ? (error as Error & { status?: number }).status : undefined;
      if (status === 401 || status === 403) return NextResponse.json({ error: "Decision Room provider authentication failed" }, { status: 502 });
      if (status === 429) return NextResponse.json({ error: "Decision Room provider rate limit reached" }, { status: 429 });
      if (status && status >= 500) return NextResponse.json({ error: "Decision Room provider is unavailable" }, { status: 502 });
      if (error instanceof Error && error.message === "ANTHROPIC_NOT_CONFIGURED") return NextResponse.json({ error: "Decision Room provider is not configured" }, { status: 500 });
      console.error("Decision Room provider response failure:", JSON.stringify({
        requestId,
        error: error instanceof Error ? error.message : "unknown error",
      }));
      return NextResponse.json({ error: "Decision Room could not produce a validated response" }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error loading Decision Room context:", JSON.stringify({
      requestId,
      error: error instanceof Error ? error.message : "unknown error",
    }));
    return NextResponse.json({ error: "Failed to load Decision Room context" }, { status: 500 });
  }
}