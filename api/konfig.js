import { PEMAN, json, paramet } from "../lib/store.js";

export async function GET() {
  const p = await paramet();
  return json({ pri: p.pri, komisyon: p.komisyon, ...PEMAN });
}
