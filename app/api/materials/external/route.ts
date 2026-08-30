import { NextResponse } from "next/server";
import { AuthorizationError, requireAuth } from "@/lib/authorization";

const ALLOWED_SOURCES = ["epc", "usgs", "openfoodfacts", "openlca"] as const;
type Source = (typeof ALLOWED_SOURCES)[number];

const categories = new Set(["concrete", "steel", "wood", "insulation", "finishes", "other"]);

export async function GET(request: Request) {
  try {
    await requireAuth();
    const url = new URL(request.url);
    const source = url.searchParams.get("source") as Source | null;
    const category = url.searchParams.get("category") || "other";

    if (!source || !ALLOWED_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Unsupported materials data source" }, { status: 400 });
    }
    if (source === "openlca" && !categories.has(category)) {
      return NextResponse.json({ error: "Unsupported material category" }, { status: 400 });
    }

    const upstreamUrl = source === "epc"
      ? "https://epc.opendatacommunities.org/api/v1/domestic/certificates?size=50&postcode=SW1A1AA"
      : source === "usgs"
        ? "https://api.usgs.gov/v1/products?source=commodity-statistics&limit=20"
        : source === "openfoodfacts"
          ? "https://world.openfoodfacts.org/api/v2/search?categories=construction-materials&fields=product_name,ecoscore_score,packaging&page_size=10"
          : `https://nexus.openlca.org/api/v1/processes?category=${encodeURIComponent(category)}&limit=1`;

    const headers: Record<string, string> = { Accept: "application/json" };
    if (source === "openfoodfacts") headers["User-Agent"] = "JengaSafi materials data client";
    if (source === "epc" && process.env.EPC_API_USERNAME && process.env.EPC_API_PASSWORD) {
      headers.Authorization = `Basic ${Buffer.from(`${process.env.EPC_API_USERNAME}:${process.env.EPC_API_PASSWORD}`).toString("base64")}`;
    }
    if (source === "openlca" && process.env.OPENLCA_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OPENLCA_API_KEY}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(upstreamUrl, {
        signal: controller.signal,
        headers,
        next: { revalidate: 300 },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json({ source, error: `${source} returned HTTP ${response.status}` }, { status: 502 });
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return NextResponse.json({ source, error: `${source} returned invalid JSON` }, { status: 502 });
    }

    return NextResponse.json({ source, data });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Materials source request timed out"
      : "Materials source is unavailable";
    console.error("Materials external source error:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}