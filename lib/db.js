// Supabase (project "Levve dijital"): workshop registrations. Server-side only, with the service-role key.
// ATELIER_MEMWA=1 swaps it for an in-memory table (local tests only).
const URL_ = process.env.SUPABASE_URL;
const KLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const memwa = process.env.ATELIER_MEMWA === "1" ? [] : null;

export const dbPare = () => !!memwa || !!(URL_ && KLE);

async function rest(chemen, opt = {}) {
  const r = await fetch(`${URL_}/rest/v1/${chemen}`, {
    ...opt,
    headers: { apikey: KLE, authorization: `Bearer ${KLE}`, "content-type": "application/json", prefer: "return=representation", ...(opt.headers || {}) },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

const T = "konferans_enskripsyon";
export const konferans = {
  async mete(rang) {
    if (memwa) { const x = { id: crypto.randomUUID(), estati: "atann", kreye: new Date().toISOString(), ...rang }; memwa.push(x); return x; }
    return (await rest(T, { method: "POST", body: JSON.stringify(rang) }))[0];
  },
  async paTelefon(kle) {
    if (memwa) return memwa.filter((x) => x.telefon_kle === kle);
    return rest(`${T}?select=id,estati&telefon_kle=eq.${encodeURIComponent(kle)}`);
  },
  async lis() {
    if (memwa) return [...memwa].sort((a, b) => b.kreye.localeCompare(a.kreye));
    return rest(`${T}?select=*&order=kreye.desc&limit=1000`);
  },
  async chanje(id, patch) {
    if (memwa) { const x = memwa.find((y) => y.id === id); if (x) Object.assign(x, patch); return x ?? null; }
    return (await rest(`${T}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }))[0] ?? null;
  },
};
