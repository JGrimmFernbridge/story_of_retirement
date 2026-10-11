import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { makeHandler } from "../../lib/media-core.mjs";

const handler = makeHandler({ getStore, getEnv: (k: string) => Netlify.env.get(k) });

export default async (req: Request) => handler(req);

export const config: Config = {
  path: ["/api/media", "/api/media/*"],
};
