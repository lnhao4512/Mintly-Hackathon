import { MongoClient, Db } from "mongodb";

const dbName = process.env.MONGODB_DB || "MINTLY";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Connect lazily: `next build` imports API route modules to collect page data, and must not
// fail (or open connections) when MONGODB_URI is only available at runtime.
function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }
  // Reuse one client per server instance (dev HMR reloads and warm serverless invocations)
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect().catch((err) => {
      global._mongoClientPromise = undefined; // allow retry after a failed connect
      throw err;
    });
  }
  return global._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(dbName);
}

export default getClient;
