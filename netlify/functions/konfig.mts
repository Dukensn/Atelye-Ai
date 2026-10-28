import type { Config } from "@netlify/functions";
import { PRI, json } from "../lib/store.mts";

export default async () =>
  json({
    pri: PRI,
    moncash: Netlify.env.get("MONCASH_NIMEWO") ?? "",
    natcash: Netlify.env.get("NATCASH_NIMEWO") ?? "",
    benefisye: Netlify.env.get("NON_BENEFISYE") ?? "",
  });

export const config: Config = { path: "/api/konfig", method: "GET" };
