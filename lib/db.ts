import mongoose from "mongoose";
import { promises as dns } from "node:dns";

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" }); // 👈 ensure .env.local is loaded here too

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

function isSrvHostnameMismatch(error: unknown) {
  return error instanceof Error && error.message.includes("Server record does not share hostname with parent URI");
}

async function buildStandardMongoUri(uri: string) {
  const parsed = new URL(uri);
  if (parsed.protocol !== "mongodb+srv:") return uri;

  const records = await dns.resolveSrv(`_mongodb._tcp.${parsed.hostname}`);
  if (records.length === 0) {
    throw new Error("MongoDB SRV discovery returned no database hosts");
  }

  const hosts = records.map(({ name, port }) => `${name.replace(/\.$/, "")}:${port}`);
  const credentials = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
    : "";
  const query = new URLSearchParams(parsed.searchParams);
  if (!query.has("tls") && !query.has("ssl")) query.set("tls", "true");

  return `mongodb://${credentials}${hosts.join(",")}${parsed.pathname || "/"}?${query.toString()}`;
}

async function connectWithSrvFallback() {
  const options = {
    dbName: "nexora",
    bufferCommands: false,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  };

  try {
    return await mongoose.connect(MONGODB_URI, options);
  } catch (error) {
    if (!isSrvHostnameMismatch(error)) throw error;
    const standardUri = await buildStandardMongoUri(MONGODB_URI);
    return mongoose.connect(standardUri, options);
  }
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const connectionPromise = connectWithSrvFallback();

    cached.promise = connectionPromise.catch((error) => {
      // Do not retain a rejected connection promise. A transient DNS/TLS
      // failure must be recoverable by the next request without restarting
      // the development server.
      cached.promise = null;
      cached.conn = null;
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }

  return cached.conn;
}
