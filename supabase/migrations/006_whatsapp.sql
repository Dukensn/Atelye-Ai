-- WhatsApp sales assistant: settings, conversations and messages, managed from /staf ("WhatsApp" tab).
-- Keys (Gemini, WhatsApp token, app secret) are write-only from the site: staff functions never return them.
-- The Vercel webhook reads them with a server secret (env WA_SEKRE), stored here only as a sha256 hash.

create table if not exists public.wa_konfig (
  id int primary key default 1 check (id = 1),
  aktif boolean not null default false,
  gemini_kle text,
  gemini_model text not null default 'gemini-2.5-flash',
  wa_token text,
  wa_phone_id text,
  app_secret text,
  verify_token text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  enstriksyon text,
  mo_relais text not null default 'ranbou, ranbouse, pwoblèm, plent, fache, vòlè, magouy, avoka',
  sekre_hash text,
  mete_le timestamptz default now());
insert into public.wa_konfig (id) values (1) on conflict (id) do nothing;

create table if not exists public.wa_konv (
  telefon text primary key,              -- digits, as WhatsApp sends them (509XXXXXXXX)
  non text,
  eta text not null default 'bot' check (eta in ('bot', 'moun')),   -- moun = a person took over, the assistant stays quiet
  poze_jiska timestamptz,                -- the assistant is quiet until then (after a team member replied)
  alet boolean not null default false,   -- needs a person
  rezon text,
  inscription_id uuid references public.inscriptions(id) on delete set null,
  jeton text,
  foto text,                             -- last payment screenshot (base64 jpeg), attached when the payment is recorded
  pa_li int not null default 0,
  denye timestamptz default now(),
  cree_le timestamptz default now());

create table if not exists public.wa_mesaj (
  id bigserial primary key,
  telefon text not null references public.wa_konv(telefon) on delete cascade,
  wa_id text unique,
  sans text not null check (sans in ('in', 'bot', 'staf')),
  teks text,
  kreye_le timestamptz default now());
create index if not exists wa_mesaj_tel on public.wa_mesaj (telefon, id desc);

alter table public.wa_konfig enable row level security;
alter table public.wa_konv enable row level security;
alter table public.wa_mesaj enable row level security;

-- new access right
create or replace function public._akse_non(p text) returns text language sql immutable as $$
  select case p
    when 'valide_peman' then 'Valide ak refize peman MonCash/NatCash'
    when 'enskri_sou_plas' then 'Enskri moun sou plas (kach)'
    when 'jwenn_tike' then 'Jwenn ak revoye tikè sou WhatsApp'
    when 'lis_enskripsyon' then 'Wè tout enskripsyon yo ak ekspòte CSV'
    when 'ranbouse_anile' then 'Anile tikè ak ranbouse'
    when 'rapel' then 'Voye rapèl WhatsApp yo'
    when 'chif' then 'Wè chif yo'
    when 'pri_evenman' then 'Chanje pri, tikè ak evènman an'
    when 'eskane' then 'Eskane tikè nan pòt la'
    when 'jere_ekip' then 'Valide manm yo, ba yo wòl, pwopoze wòl'
    when 'whatsapp' then 'Jere asistan WhatsApp la ak konvèsasyon yo'
    else p end
$$;
create or replace function public._akse_tout() returns text[] language sql immutable as $$
  select array['valide_peman','enskri_sou_plas','jwenn_tike','lis_enskripsyon','ranbouse_anile','rapel','chif','pri_evenman','eskane','jere_ekip','whatsapp']
$$;

create or replace function public._wa_sekre(p_sekre text) returns public.wa_konfig language plpgsql stable
set search_path = public, extensions as $$
declare k public.wa_konfig;
begin
  select * into k from public.wa_konfig where id = 1;
  if k.sekre_hash is null or coalesce(p_sekre, '') = '' or encode(digest(p_sekre, 'sha256'), 'hex') <> k.sekre_hash then
    raise exception 'Aksè refize.'; end if;
  return k;
end $$;

-- ---------------------------------------------------------------- staff side
create or replace function public.staf_wa_konfig(p_code text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'whatsapp'); k public.wa_konfig;
begin
  select * into k from public.wa_konfig where id = 1;
  return jsonb_build_object('aktif', k.aktif, 'gemini_model', k.gemini_model, 'wa_phone_id', k.wa_phone_id, 'verify_token', k.verify_token,
    'enstriksyon', k.enstriksyon, 'mo_relais', k.mo_relais,
    'gemini', k.gemini_kle is not null, 'gemini_fen', right(k.gemini_kle, 4),
    'wa_token', k.wa_token is not null, 'app_secret', k.app_secret is not null, 'sevè', k.sekre_hash is not null,
    'alet', (select count(*) from public.wa_konv where alet), 'pa_li', (select coalesce(sum(pa_li), 0) from public.wa_konv));
end $$;

create or replace function public.staf_wa_konfig_mete(p_code text, p jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'whatsapp');
  g text := nullif(btrim(coalesce(p->>'gemini_kle', '')), ''); w text := nullif(btrim(coalesce(p->>'wa_token', '')), '');
  a text := nullif(btrim(coalesce(p->>'app_secret', '')), ''); ph text := nullif(regexp_replace(coalesce(p->>'wa_phone_id', ''), '\D', '', 'g'), '');
begin
  if g is not null and (length(g) < 20 or length(g) > 200 or g ~ '\s') then raise exception 'Kle Gemini a pa sanble bon.'; end if;
  if w is not null and (length(w) < 20 or length(w) > 1000 or w ~ '\s') then raise exception 'Token WhatsApp la pa sanble bon.'; end if;
  if a is not null and a !~ '^[a-f0-9]{32}$' then raise exception 'App secret la dwe gen 32 karaktè (0-9, a-f).'; end if;
  if coalesce(p->>'gemini_model', '') !~ '^[a-z0-9.\-]{3,60}$' and p ? 'gemini_model' then raise exception 'Non modèl la pa bon.'; end if;
  update public.wa_konfig set
    aktif = coalesce((p->>'aktif')::boolean, aktif),
    gemini_kle = coalesce(g, gemini_kle), wa_token = coalesce(w, wa_token), app_secret = coalesce(a, app_secret),
    wa_phone_id = case when p ? 'wa_phone_id' then ph else wa_phone_id end,
    gemini_model = coalesce(nullif(p->>'gemini_model', ''), gemini_model),
    enstriksyon = case when p ? 'enstriksyon' then left(nullif(btrim(p->>'enstriksyon'), ''), 4000) else enstriksyon end,
    mo_relais = case when p ? 'mo_relais' then left(coalesce(p->>'mo_relais', ''), 500) else mo_relais end,
    mete_le = now()
  where id = 1;
  return public.staf_wa_konfig(p_code);
end $$;

create or replace function public.staf_wa_konv(p_code text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'whatsapp');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('telefon', c.telefon, 'non', c.non, 'eta', c.eta, 'poze_jiska', c.poze_jiska, 'alet', c.alet,
      'rezon', c.rezon, 'pa_li', c.pa_li, 'denye', c.denye,
      'code_court', i.code_court, 'statut', i.statut, 'peye', i.reference_paiement is not null,
      'dènye', (select jsonb_build_object('sans', m.sans, 'teks', left(m.teks, 120)) from public.wa_mesaj m where m.telefon = c.telefon order by m.id desc limit 1))
    order by c.alet desc, c.denye desc)
    from (select * from public.wa_konv order by alet desc, denye desc limit 300) c left join public.inscriptions i on i.id = c.inscription_id), '[]'::jsonb);
end $$;

create or replace function public.staf_wa_mesaj(p_code text, p_tel text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'whatsapp');
begin
  update public.wa_konv set pa_li = 0 where telefon = p_tel;
  return coalesce((select jsonb_agg(x order by x.id) from (select m.id, m.sans, m.teks, m.kreye_le from public.wa_mesaj m
    where m.telefon = p_tel order by m.id desc limit 200) x), '[]'::jsonb);
end $$;

-- 'bot' gives the conversation back to the assistant; 'moun' = a person takes over until given back
create or replace function public.staf_wa_eta(p_code text, p_tel text, p_eta text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'whatsapp');
begin
  if p_eta not in ('bot', 'moun') then raise exception 'Eta a pa bon.'; end if;
  update public.wa_konv set eta = p_eta, poze_jiska = null, alet = case when p_eta = 'bot' then false else alet end,
    rezon = case when p_eta = 'bot' then null else rezon end where telefon = p_tel;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- server side (Vercel webhook, with WA_SEKRE)
create or replace function public.wa_sv_konfig(p_sekre text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare k public.wa_konfig := public._wa_sekre(p_sekre);
begin
  return jsonb_build_object('aktif', k.aktif, 'gemini_kle', k.gemini_kle, 'gemini_model', k.gemini_model, 'wa_token', k.wa_token,
    'wa_phone_id', k.wa_phone_id, 'app_secret', k.app_secret, 'verify_token', k.verify_token, 'enstriksyon', k.enstriksyon,
    'evenement', public.evenement_public(null), 'gwoup', (select lyen_gwoup from public.evenements where id = (public._evt(null)).id));
end $$;

create or replace function public._wa_eta_konv(p_tel text) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('non', c.non, 'eta', c.eta, 'foto', c.foto is not null,
    'enskripsyon', case when i.id is null then null else jsonb_build_object('code_court', i.code_court, 'statut', i.statut, 'montant', i.montant,
      'moyen', i.moyen_paiement, 'referans_voye', i.reference_paiement is not null, 'tip', t.nom,
      'tike', (select b.code from public.billets b where b.inscription_id = i.id and b.statut <> 'annule' limit 1)) end)
  from public.wa_konv c left join public.inscriptions i on i.id = c.inscription_id left join public.types_billets t on t.id = i.type_billet_id
  where c.telefon = p_tel
$$;

-- an incoming message: stored once (WhatsApp can deliver twice), then says whether the assistant should answer
create or replace function public.wa_sv_resevwa(p_sekre text, p_tel text, p_non text, p_wa_id text, p_teks text, p_foto text default null) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare k public.wa_konfig := public._wa_sekre(p_sekre); c public.wa_konv; tel text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
  mo text; relais text;
begin
  if length(tel) < 8 or length(tel) > 15 then raise exception 'Nimewo a pa bon.'; end if;
  if p_wa_id is not null and exists (select 1 from public.wa_mesaj where wa_id = p_wa_id) then return jsonb_build_object('dub', true); end if;
  insert into public.wa_konv (telefon, non) values (tel, left(nullif(btrim(p_non), ''), 80))
    on conflict (telefon) do update set non = coalesce(public.wa_konv.non, excluded.non);
  update public.wa_konv set pa_li = pa_li + 1, denye = now(),
    foto = case when p_foto is not null and length(p_foto) <= 1400000 then p_foto else foto end where telefon = tel;
  insert into public.wa_mesaj (telefon, wa_id, sans, teks) values (tel, p_wa_id, 'in', left(coalesce(p_teks, ''), 4000));
  -- words that call a person (refund, complaint, anger...)
  foreach mo in array regexp_split_to_array(lower(coalesce(k.mo_relais, '')), '\s*,\s*') loop
    if length(mo) >= 3 and position(mo in lower(coalesce(p_teks, ''))) > 0 then relais := mo; exit; end if;
  end loop;
  if relais is not null then update public.wa_konv set eta = 'moun', alet = true, rezon = 'Mo: ' || relais where telefon = tel; end if;
  select * into c from public.wa_konv where telefon = tel;
  return jsonb_build_object('reponn', k.aktif and c.eta = 'bot' and (c.poze_jiska is null or c.poze_jiska < now()),
    'relais', relais, 'konv', public._wa_eta_konv(tel),
    'istwa', coalesce((select jsonb_agg(jsonb_build_object('sans', x.sans, 'teks', x.teks) order by x.id) from
      (select id, sans, teks from public.wa_mesaj where telefon = tel order by id desc limit 20) x), '[]'::jsonb));
end $$;

-- an outgoing message (assistant, or a team member: then the assistant stays quiet 24 h)
create or replace function public.wa_sv_ekri(p_sekre text, p_tel text, p_sans text, p_teks text, p_wa_id text default null) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare k public.wa_konfig := public._wa_sekre(p_sekre); tel text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
begin
  if p_sans not in ('bot', 'staf') then raise exception 'Sans lan pa bon.'; end if;
  if p_wa_id is not null and exists (select 1 from public.wa_mesaj where wa_id = p_wa_id) then return jsonb_build_object('dub', true); end if;
  insert into public.wa_konv (telefon) values (tel) on conflict (telefon) do nothing;
  insert into public.wa_mesaj (telefon, wa_id, sans, teks) values (tel, p_wa_id, p_sans, left(coalesce(p_teks, ''), 4000));
  update public.wa_konv set denye = now(), poze_jiska = case when p_sans = 'staf' then now() + interval '24 hours' else poze_jiska end,
    pa_li = case when p_sans = 'staf' then 0 else pa_li end where telefon = tel;
  return jsonb_build_object('ok', true);
end $$;

-- the assistant hands the conversation to a person
create or replace function public.wa_sv_relais(p_sekre text, p_tel text, p_rezon text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare k public.wa_konfig := public._wa_sekre(p_sekre);
begin
  update public.wa_konv set eta = 'moun', alet = true, rezon = left(coalesce(nullif(btrim(p_rezon), ''), 'Asistan an mande yon moun'), 200)
    where telefon = regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
  return jsonb_build_object('ok', true);
end $$;

-- the assistant books a ticket for the person writing (same rules as the site: inscrire)
create or replace function public.wa_sv_rezeve(p_sekre text, p_tel text, p_non text, p_tip text, p_moyen text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare k public.wa_konfig := public._wa_sekre(p_sekre); tel text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
  e public.evenements := public._evt(null); t public.types_billets; deja public.inscriptions; r jsonb;
begin
  if e.id is null then raise exception 'Pa gen evènman ouvè.'; end if;
  select * into deja from public.inscriptions where evenement_id = e.id and telephone_cle = public._tel_cle(tel) and statut <> 'refuse' order by cree_le desc limit 1;
  if deja.id is not null then
    update public.wa_konv set inscription_id = deja.id, jeton = deja.jeton where telefon = tel;
    return jsonb_build_object('deja', true, 'enskripsyon', public._wa_eta_konv(tel)->'enskripsyon');
  end if;
  select tb.* into t from public.types_billets tb where tb.evenement_id = e.id and tb.prix_htg is not null
    and (tb.date_fin_vente is null or tb.date_fin_vente > now()) and not public._bloke(tb.id) and public._restants_type(tb.id) > 0
    and (coalesce(p_tip, '') = '' or lower(tb.nom) like '%' || lower(left(regexp_replace(p_tip, '[^[:alpha:]]', '', 'g'), 4)) || '%')
    order by tb.ordre, tb.prix_htg limit 1;
  if t.id is null then raise exception 'Tikè sa a pa disponib kounye a.'; end if;
  r := public.inscrire(t.id, p_non, '+' || tel, null, '{"sous":"whatsapp"}'::jsonb, case when p_moyen = 'natcash' then 'natcash' else 'moncash' end);
  update public.wa_konv set inscription_id = (r->>'id')::uuid, jeton = r->>'jeton', non = coalesce(non, btrim(p_non)) where telefon = tel;
  return jsonb_build_object('ok', true, 'enskripsyon', public._wa_eta_konv(tel)->'enskripsyon');
end $$;

-- the assistant records the transaction number (with the last screenshot, if one was sent)
create or replace function public.wa_sv_peman(p_sekre text, p_tel text, p_referans text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare k public.wa_konfig := public._wa_sekre(p_sekre); c public.wa_konv; r jsonb;
begin
  select * into c from public.wa_konv where telefon = regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
  if c.inscription_id is null then raise exception 'Pa gen rezèvasyon pou nimewo sa a. Rezève anvan.'; end if;
  r := public.soumettre_paiement(c.inscription_id, c.jeton, p_referans, c.foto, 'image/jpeg');
  update public.wa_konv set foto = null where telefon = c.telefon;
  return jsonb_build_object('ok', true, 'enskripsyon', public._wa_eta_konv(c.telefon)->'enskripsyon');
end $$;

revoke all on function public._wa_sekre(text), public._wa_eta_konv(text) from public, anon, authenticated;
grant execute on function public.staf_wa_konfig(text), public.staf_wa_konfig_mete(text, jsonb), public.staf_wa_konv(text),
  public.staf_wa_mesaj(text, text), public.staf_wa_eta(text, text, text),
  public.wa_sv_konfig(text), public.wa_sv_resevwa(text, text, text, text, text, text), public.wa_sv_ekri(text, text, text, text, text),
  public.wa_sv_relais(text, text, text), public.wa_sv_rezeve(text, text, text, text, text), public.wa_sv_peman(text, text, text)
  to anon, authenticated;
