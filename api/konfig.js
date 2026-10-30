import { PEMAN, json, paramet } from "../lib/store.js";

export async function GET() {
  const p = await paramet();
  return json({ pri: p.pri, komisyon: p.komisyon, lyen_peman: p.lyen_peman || "", tradui: !!p.tradui, manyel: p.manyel || !p.lyen_peman, otomatik: !!(process.env.KOBARA_SECRET_KEY && p.otomatik), ...PEMAN });
}
