import { PEMAN, json, paramet } from "../lib/store.js";

export async function GET() {
  const p = await paramet();
  return json({ pri: p.pri, komisyon: p.komisyon, moncashOnline: !!(p.moncash && process.env.MONCASH_SECRET_KEY), manyel: p.manyel || !(p.moncash && process.env.MONCASH_SECRET_KEY), ...PEMAN });
}
