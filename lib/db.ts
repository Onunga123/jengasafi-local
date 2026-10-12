import mongoose from "mongoose";

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

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const connectionPromise = mongoose.connect(MONGODB_URI, {
      dbName: "nexora",
      bufferCommands: false,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });

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
