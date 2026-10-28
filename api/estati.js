import { json, kontni, li, netwaye } from "../lib/store.js";

// The installed app polls this while the student waits; once accepted it hands back the access key,
// so the app opens the student space by itself. The id is a random UUID only that phone knows.
export async function GET(req) {
  const id = netwaye(new URL(req.url).searchParams.get("id"), 40);
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ ere: "id" }, 404);
  const e = await li(`enskripsyon/${id}.json`);
  if (!e) return json({ ere: "id" }, 404);
  const paye = e.estati === "atann" || e.estati === "aksepte";
  return json({
    estati: e.estati,
    non: e.non.split(" ")[0],
    ...(paye ? { kominote: (await kontni()).lyen_kominote } : {}),
    ...(e.estati === "aksepte" && e.token ? { kle: e.token } : {}),
  });
}
