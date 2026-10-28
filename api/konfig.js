import { PRI, json } from "../lib/store.js";

export function GET() {
  return json({
    pri: PRI,
    moncash: process.env.MONCASH_NIMEWO ?? "",
    natcash: process.env.NATCASH_NIMEWO ?? "",
    benefisye: process.env.NON_BENEFISYE ?? "",
  });
}
