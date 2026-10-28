import { PEMAN, PRI, json } from "../lib/store.js";

export function GET() {
  return json({ pri: PRI, ...PEMAN });
}
