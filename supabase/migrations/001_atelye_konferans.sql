-- Atelye konferans: registrations, manual payment validation, QR tickets, offline scanner.
-- Run once in Supabase → SQL Editor (project "Atelye AI"). Safe to run again.
--
-- Security model
--   * RLS is ON for every table and there is NO policy: the public key cannot read or write any table directly.
--   * Everything goes through the functions below (security definer, fixed search_path).
--   * Public functions: evenement_public, inscrire, soumettre_paiement, billet_public, retrouver_billet.
--   * Staff functions take the person's staff code (checked with bcrypt) and their role:
--       admin       everything
--       validateur  payment queue, validate / refuse
--       scanneur    ticket list and scans on the day
--   * Validation and ticket creation exist only server-side (staf_valide, staf_kach).
--   * Payment screenshots are stored in a private table (no public access), read by staff only.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables (adapted, never dropped)
create table if not exists public.evenements (id uuid primary key default gen_random_uuid());
alter table public.evenements
  add column if not exists nom text,
  add column if not exists date timestamptz,
  add column if not exists lieu text,
  add column if not exists adresse text,
  add column if not exists capacite int,
  add column if not exists statut text default 'ouvert',
  add column if not exists cree_le timestamptz default now();

create table if not exists public.types_billets (id uuid primary key default gen_random_uuid());
alter table public.types_billets
  add column if not exists evenement_id uuid references public.evenements(id) on delete cascade,
  add column if not exists nom text,
  add column if not exists prix_usd numeric(10,2),
  add column if not exists prix_htg numeric(12,2),
  add column if not exists quota int,
  add column if not exists date_fin_vente timestamptz,
  add column if not exists ordre int default 0,
  add column if not exists avantaj jsonb default '[]'::jsonb;

create table if not exists public.inscriptions (id uuid primary key default gen_random_uuid());
alter table public.inscriptions
  add column if not exists evenement_id uuid references public.evenements(id) on delete cascade,
  add column if not exists type_billet_id uuid references public.types_billets(id),
  add column if not exists code_court text,
  add column if not exists jeton text,
  add column if not exists nom text,
  add column if not exists telephone text,
  add column if not exists telephone_cle text,
  add column if not exists email text,
  add column if not exists reponses jsonb default '{}'::jsonb,
  add column if not exists moyen_paiement text,
  add column if not exists reference_paiement text,
  add column if not exists montant numeric(12,2),
  add column if not exists devise text default 'HTG',
  add column if not exists statut text default 'en_attente',
  add column if not exists motif_refus text,
  add column if not exists valide_par text,
  add column if not exists valide_le timestamptz,
  add column if not exists soumis_le timestamptz,
  add column if not exists cree_le timestamptz default now();

create table if not exists public.billets (id uuid primary key default gen_random_uuid());
alter table public.billets
  add column if not exists inscription_id uuid references public.inscriptions(id) on delete cascade,
  add column if not exists code text,
  add column if not exists statut text default 'actif',
  add column if not exists scanne_le timestamptz,
  add column if not exists scanne_par text,
  add column if not exists cree_le timestamptz default now();

create table if not exists public.scans (id uuid primary key default gen_random_uuid());
alter table public.scans
  add column if not exists billet_id uuid references public.billets(id) on delete set null,
  add column if not exists code text,
  add column if not exists appareil text,
  add column if not exists resultat text,
  add column if not exists scanne_le timestamptz,
  add column if not exists synchronise boolean default true,
  add column if not exists recu_le timestamptz default now();

create table if not exists public.captures (inscription_id uuid primary key references public.inscriptions(id) on delete cascade);
alter table public.captures
  add column if not exists image bytea,
  add column if not exists type text default 'image/jpeg',
  add column if not exists cree_le timestamptz default now();

create table if not exists public.staf (id uuid primary key default gen_random_uuid());
alter table public.staf
  add column if not exists non text,
  add column if not exists role text,
  add column if not exists code_hash text,
  add column if not exists actif boolean default true,
  add column if not exists cree_le timestamptz default now();

-- ---------------------------------------------------------------- integrity rules
do $$ begin
  alter table public.inscriptions add constraint inscriptions_statut_ck check (statut in ('en_attente','valide','refuse','rembourse'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.billets add constraint billets_statut_ck check (statut in ('actif','utilise','annule'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.staf add constraint staf_role_ck check (role in ('admin','validateur','scanneur'));
exception when duplicate_object then null; end $$;

create unique index if not exists inscriptions_tel_evt_uq on public.inscriptions (evenement_id, telephone_cle);
create unique index if not exists inscriptions_code_evt_uq on public.inscriptions (evenement_id, code_court);
-- one payment reference can validate only one registration
create unique index if not exists inscriptions_ref_valide_uq on public.inscriptions (evenement_id, lower(reference_paiement))
  where statut = 'valide' and reference_paiement is not null;
create unique index if not exists billets_code_uq on public.billets (code);
create unique index if not exists billets_inscription_uq on public.billets (inscription_id);
create index if not exists inscriptions_file_ix on public.inscriptions (evenement_id, statut, soumis_le);

-- ---------------------------------------------------------------- RLS on, no policy: tables are private
alter table public.evenements enable row level security;
alter table public.types_billets enable row level security;
alter table public.inscriptions enable row level security;
alter table public.billets enable row level security;
alter table public.scans enable row level security;
alter table public.captures enable row level security;
alter table public.staf enable row level security;
revoke all on public.evenements, public.types_billets, public.inscriptions, public.billets, public.scans, public.captures, public.staf from anon, authenticated;

-- ---------------------------------------------------------------- helpers (not callable from the site)
create or replace function public._tel_cle(p text) returns text language sql immutable as $$
  select case when length(d) = 8 then '509' || d else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create or replace function public._code_billet() returns text language plpgsql volatile
set search_path = public, extensions as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea := gen_random_bytes(12); c text := ''; i int;
begin
  for i in 0..11 loop c := c || substr(a, 1 + (get_byte(b, i) % length(a)), 1); end loop;
  return c;
end $$;

create or replace function public._staf(p_code text, p_roles text[]) returns public.staf language plpgsql stable
set search_path = public, extensions as $$
declare s public.staf;
begin
  select * into s from public.staf where actif and code_hash = crypt(coalesce(p_code, ''), code_hash) limit 1;
  if s.id is null or not (s.role = any (p_roles)) then raise exception 'Kòd la pa bon oswa ou pa gen aksè.' using errcode = '28000'; end if;
  return s;
end $$;

create or replace function public._restants_type(p_type uuid) returns int language sql stable set search_path = public as $$
  select coalesce(t.quota, 0) - (select count(*) from public.billets b join public.inscriptions i on i.id = b.inscription_id
                                  where i.type_billet_id = t.id and b.statut <> 'annule')::int
  from public.types_billets t where t.id = p_type
$$;

create or replace function public._evt(p_evenement uuid) returns public.evenements language sql stable set search_path = public as $$
  select * from public.evenements
  where (p_evenement is not null and id = p_evenement) or (p_evenement is null and statut = 'ouvert')
  order by date limit 1
$$;

-- A dearer ticket opens only once every cheaper one (early bird) is sold out or past its end date.
create or replace function public._bloke(p_type uuid) returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.types_billets t join public.types_billets c on c.evenement_id = t.evenement_id and c.id <> t.id
    where t.id = p_type and c.prix_htg is not null and c.prix_htg < t.prix_htg
      and (c.date_fin_vente is null or c.date_fin_vente > now()) and public._restants_type(c.id) > 0)
$$;
create or replace function public._ouvre_le(p_type uuid) returns timestamptz language sql stable set search_path = public as $$
  select max(c.date_fin_vente) from public.types_billets t join public.types_billets c on c.evenement_id = t.evenement_id and c.id <> t.id
    where t.id = p_type and c.prix_htg is not null and c.prix_htg < t.prix_htg
      and (c.date_fin_vente is null or c.date_fin_vente > now()) and public._restants_type(c.id) > 0
$$;

-- ---------------------------------------------------------------- public functions
create or replace function public.evenement_public(p_evenement uuid default null) returns jsonb language plpgsql stable
security definer set search_path = public as $$
declare e public.evenements := public._evt(p_evenement); pris int;
begin
  if e.id is null then return null; end if;
  select count(*) into pris from public.billets b join public.inscriptions i on i.id = b.inscription_id
    where i.evenement_id = e.id and b.statut <> 'annule';
  return jsonb_build_object('id', e.id, 'nom', e.nom, 'date', e.date, 'lieu', e.lieu, 'adresse', e.adresse,
    'capacite', e.capacite, 'restants', greatest(coalesce(e.capacite, 0) - pris, 0), 'statut', e.statut,
    'types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nom', t.nom, 'prix_usd', t.prix_usd, 'prix_htg', t.prix_htg,
        'date_fin_vente', t.date_fin_vente, 'quota', t.quota, 'avantaj', coalesce(t.avantaj, '[]'::jsonb),
        'restants', greatest(public._restants_type(t.id), 0), 'bloke', public._bloke(t.id), 'ouvre_le', public._ouvre_le(t.id)) order by t.ordre, t.prix_htg)
      from public.types_billets t where t.evenement_id = e.id and t.prix_htg is not null
        and (t.date_fin_vente is null or t.date_fin_vente > now())), '[]'::jsonb));
end $$;

create or replace function public.inscrire(p_type uuid, p_nom text, p_telephone text, p_email text default null,
  p_reponses jsonb default '{}'::jsonb, p_moyen text default 'moncash') returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare t public.types_billets; e public.evenements; v_nom text := btrim(coalesce(p_nom, '')); cle text := public._tel_cle(p_telephone);
  em text := nullif(btrim(coalesce(p_email, '')), ''); deja public.inscriptions; v_code text; j text := encode(gen_random_bytes(18), 'hex'); r public.inscriptions;
begin
  select * into t from public.types_billets where id = p_type;
  select * into e from public.evenements where id = t.evenement_id;
  if t.id is null or e.statut <> 'ouvert' or t.prix_htg is null or (t.date_fin_vente is not null and t.date_fin_vente <= now())
    then raise exception 'Tikè sa a pa disponib ankò.'; end if;
  if public._restants_type(t.id) <= 0 then raise exception 'Pa gen plas ankò pou tikè sa a.'; end if;
  if public._bloke(t.id) then raise exception 'Tikè sa a poko disponib: pran tikè Lève-bonè a pandan l la.'; end if;
  if length(v_nom) < 2 or length(v_nom) > 80 then raise exception 'Ekri non w.'; end if;
  if length(cle) < 11 or length(cle) > 15 then raise exception 'Nimewo WhatsApp la pa bon.'; end if;
  if em is not null and (length(em) > 120 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'Imèl la pa bon.'; end if;
  if p_moyen not in ('moncash', 'natcash') then raise exception 'Chwazi MonCash oswa NatCash.'; end if;
  if pg_column_size(p_reponses) > 4000 then raise exception 'Repons yo twò long.'; end if;

  select * into deja from public.inscriptions where evenement_id = e.id and telephone_cle = cle for update;
  if deja.id is not null and deja.statut <> 'refuse' then
    raise exception 'Nimewo sa a enskri deja. Chèche tikè w nan « Jwenn tikè mwen ».';
  end if;
  if deja.id is not null then
    update public.inscriptions set type_billet_id = t.id, nom = v_nom, telephone = btrim(p_telephone), email = em, reponses = coalesce(p_reponses, '{}'),
      moyen_paiement = p_moyen, reference_paiement = null, montant = t.prix_htg, statut = 'en_attente', motif_refus = null,
      jeton = j, soumis_le = null, cree_le = now()
      where id = deja.id returning * into r;
    update public.captures set image = null where inscription_id = r.id;
  else
    loop
      v_code := 'AT-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
      exit when not exists (select 1 from public.inscriptions where evenement_id = e.id and code_court = v_code);
    end loop;
    insert into public.inscriptions (evenement_id, type_billet_id, code_court, jeton, nom, telephone, telephone_cle, email, reponses, moyen_paiement, montant, devise)
      values (e.id, t.id, v_code, j, v_nom, btrim(p_telephone), cle, em, coalesce(p_reponses, '{}'), p_moyen, t.prix_htg, 'HTG') returning * into r;
  end if;
  return jsonb_build_object('id', r.id, 'jeton', r.jeton, 'code_court', r.code_court, 'montant', r.montant, 'prix_usd', t.prix_usd,
    'moyen', r.moyen_paiement, 'type', t.nom);
end $$;

create or replace function public.soumettre_paiement(p_id uuid, p_jeton text, p_reference text, p_capture text default null,
  p_capture_type text default 'image/jpeg') returns jsonb language plpgsql volatile
security definer set search_path = public as $$
declare r public.inscriptions; ref text := upper(btrim(coalesce(p_reference, ''))); img bytea;
begin
  select * into r from public.inscriptions where id = p_id and jeton = p_jeton for update;
  if r.id is null then raise exception 'Enskripsyon sa a pa egziste.'; end if;
  if r.statut <> 'en_attente' then raise exception 'Enskripsyon sa a deja trete.'; end if;
  if length(ref) < 4 or length(ref) > 40 then raise exception 'Ekri nimewo tranzaksyon an.'; end if;
  if exists (select 1 from public.inscriptions where evenement_id = r.evenement_id and statut = 'valide' and lower(reference_paiement) = lower(ref))
    then raise exception 'Nimewo tranzaksyon sa a deja itilize.'; end if;
  update public.inscriptions set reference_paiement = ref, soumis_le = now() where id = r.id;
  if p_capture is not null and length(p_capture) > 0 then
    if length(p_capture) > 1400000 then raise exception 'Foto a twò lou (1 MB maksimòm).'; end if;
    if p_capture_type not in ('image/jpeg', 'image/png', 'image/webp') then raise exception 'Foto a dwe JPG, PNG oswa WEBP.'; end if;
    img := decode(p_capture, 'base64');
    insert into public.captures (inscription_id, image, type) values (r.id, img, p_capture_type)
      on conflict (inscription_id) do update set image = excluded.image, type = excluded.type, cree_le = now();
  end if;
  return jsonb_build_object('ok', true, 'code_court', r.code_court);
end $$;

create or replace function public.billet_public(p_code text) returns jsonb language sql stable
security definer set search_path = public as $$
  select jsonb_build_object('code', b.code, 'statut', b.statut, 'numero', i.code_court, 'nom', i.nom, 'type', t.nom,
    'evenement', jsonb_build_object('nom', e.nom, 'date', e.date, 'lieu', e.lieu, 'adresse', e.adresse))
  from public.billets b join public.inscriptions i on i.id = b.inscription_id
  join public.types_billets t on t.id = i.type_billet_id join public.evenements e on e.id = i.evenement_id
  where b.code = upper(btrim(coalesce(p_code, '')))
$$;

-- Find a ticket: phone number + the short code (AT-0427), so a phone number alone is not enough.
create or replace function public.retrouver_billet(p_telephone text, p_code_court text) returns jsonb language sql stable
security definer set search_path = public as $$
  select jsonb_build_object('statut', i.statut, 'motif', i.motif_refus, 'billet', b.code)
  from public.inscriptions i left join public.billets b on b.inscription_id = i.id and b.statut <> 'annule'
  where i.telephone_cle = public._tel_cle(p_telephone) and upper(i.code_court) = upper(btrim(coalesce(p_code_court, '')))
  order by i.cree_le desc limit 1
$$;

-- ---------------------------------------------------------------- staff functions
-- First admin: run once in the SQL Editor (not callable from the site):  select public.staf_premye_admin('Duke', 'a-long-secret-code');
create or replace function public.staf_premye_admin(p_non text, p_code text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from public.staf where role = 'admin') then raise exception 'Gen yon admin deja.'; end if;
  if length(coalesce(p_code, '')) < 10 then raise exception 'Kòd la dwe gen omwen 10 karaktè.'; end if;
  insert into public.staf (non, role, code_hash) values (p_non, 'admin', crypt(p_code, gen_salt('bf', 10)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_konekte(p_code text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur','scanneur']);
begin
  return jsonb_build_object('non', s.non, 'role', s.role, 'evenement', public.evenement_public(null));
end $$;

create or replace function public.staf_kreye(p_code text, p_non text, p_role text, p_nouvo_code text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin']);
begin
  if p_role not in ('admin','validateur','scanneur') then raise exception 'Wòl la pa bon.'; end if;
  if length(coalesce(p_nouvo_code, '')) < 10 then raise exception 'Kòd la dwe gen omwen 10 karaktè.'; end if;
  insert into public.staf (non, role, code_hash) values (btrim(p_non), p_role, crypt(p_nouvo_code, gen_salt('bf', 10)));
  return jsonb_build_object('ok', true);
end $$;

-- Event and ticket types (prices, quotas, early-bird end date) edited from the staff page.
create or replace function public.staf_evenement(p_code text, p_evenement jsonb, p_types jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin']); eid uuid := nullif(p_evenement->>'id', '')::uuid; t jsonb;
begin
  if eid is null then
    insert into public.evenements (nom, date, lieu, adresse, capacite, statut) values
      (p_evenement->>'nom', (p_evenement->>'date')::timestamptz, p_evenement->>'lieu', p_evenement->>'adresse',
       (p_evenement->>'capacite')::int, coalesce(p_evenement->>'statut', 'ouvert')) returning id into eid;
  else
    update public.evenements set nom = p_evenement->>'nom', date = (p_evenement->>'date')::timestamptz, lieu = p_evenement->>'lieu',
      adresse = p_evenement->>'adresse', capacite = (p_evenement->>'capacite')::int, statut = coalesce(p_evenement->>'statut', statut)
      where id = eid;
  end if;
  for t in select * from jsonb_array_elements(coalesce(p_types, '[]'::jsonb)) loop
    if nullif(t->>'id', '') is null then
      insert into public.types_billets (evenement_id, nom, prix_usd, prix_htg, quota, date_fin_vente, ordre, avantaj) values
        (eid, t->>'nom', nullif(t->>'prix_usd', '')::numeric, nullif(t->>'prix_htg', '')::numeric, (t->>'quota')::int,
         nullif(t->>'date_fin_vente', '')::timestamptz, coalesce((t->>'ordre')::int, 0), coalesce(t->'avantaj', '[]'::jsonb));
    else
      update public.types_billets set nom = t->>'nom', prix_usd = nullif(t->>'prix_usd', '')::numeric, prix_htg = nullif(t->>'prix_htg', '')::numeric,
        quota = (t->>'quota')::int, date_fin_vente = nullif(t->>'date_fin_vente', '')::timestamptz, ordre = coalesce((t->>'ordre')::int, 0),
        avantaj = coalesce(t->'avantaj', avantaj)
        where id = (t->>'id')::uuid and evenement_id = eid;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'id', eid);
end $$;

create or replace function public.staf_tablo(p_code text, p_evenement uuid default null) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur']); e public.evenements := public._evt(p_evenement); res jsonb;
begin
  if e.id is null then return jsonb_build_object('role', s.role, 'evenement', null); end if;
  res := jsonb_build_object('role', s.role, 'non', s.non,
    'evenement', to_jsonb(e),
    'types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nom', t.nom, 'prix_usd', t.prix_usd, 'prix_htg', t.prix_htg, 'quota', t.quota,
        'date_fin_vente', t.date_fin_vente, 'ordre', t.ordre, 'avantaj', coalesce(t.avantaj, '[]'::jsonb), 'restants', public._restants_type(t.id)) order by t.ordre, t.prix_htg)
      from public.types_billets t where t.evenement_id = e.id), '[]'),
    'chif', (select jsonb_build_object(
        'inscrits', count(*) filter (where statut <> 'refuse'),
        'payes', count(*) filter (where statut = 'valide'),
        'en_attente', count(*) filter (where statut = 'en_attente' and reference_paiement is not null),
        'sans_paiement', count(*) filter (where statut = 'en_attente' and reference_paiement is null),
        'refuses', count(*) filter (where statut = 'refuse'),
        'recettes_htg', coalesce(sum(montant) filter (where statut = 'valide'), 0))
      from public.inscriptions where evenement_id = e.id),
    'file', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'code_court', i.code_court, 'nom', i.nom, 'telephone', i.telephone,
        'type', t.nom, 'montant', i.montant, 'moyen', i.moyen_paiement, 'reference', i.reference_paiement, 'soumis_le', i.soumis_le,
        'capture', exists (select 1 from public.captures c where c.inscription_id = i.id and c.image is not null)) order by i.soumis_le)
      from public.inscriptions i join public.types_billets t on t.id = i.type_billet_id
      where i.evenement_id = e.id and i.statut = 'en_attente' and i.reference_paiement is not null), '[]'));
  if s.role = 'admin' then
    res := res || jsonb_build_object(
      'par_jour', coalesce((select jsonb_agg(jsonb_build_object('jour', d, 'n', n) order by d)
        from (select (cree_le at time zone 'America/Port-au-Prince')::date d, count(*) n from public.inscriptions
              where evenement_id = e.id group by 1) x), '[]'),
      'lis', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'code_court', i.code_court, 'nom', i.nom, 'telephone', i.telephone,
          'email', i.email, 'type', t.nom, 'montant', i.montant, 'moyen', i.moyen_paiement, 'reference', i.reference_paiement,
          'statut', i.statut, 'motif', i.motif_refus, 'reponses', i.reponses, 'cree_le', i.cree_le, 'valide_le', i.valide_le, 'valide_par', i.valide_par,
          'billet', b.code, 'billet_statut', b.statut, 'scanne_le', b.scanne_le) order by i.cree_le desc)
        from public.inscriptions i join public.types_billets t on t.id = i.type_billet_id left join public.billets b on b.inscription_id = i.id
        where i.evenement_id = e.id), '[]'),
      'jour_j', (select jsonb_build_object('entres', count(*) filter (where b.statut = 'utilise'), 'attendus', count(*) filter (where b.statut <> 'annule'))
        from public.billets b join public.inscriptions i on i.id = b.inscription_id where i.evenement_id = e.id));
  end if;
  return res;
end $$;

create or replace function public.staf_kapti(p_code text, p_id uuid) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur']); c public.captures;
begin
  select * into c from public.captures where inscription_id = p_id and image is not null;
  if c.inscription_id is null then return null; end if;
  return jsonb_build_object('type', c.type, 'data', encode(c.image, 'base64'));
end $$;

create or replace function public._cree_billet(p_inscription uuid) returns text language plpgsql volatile
set search_path = public, extensions as $$
declare v_code text;
begin
  loop
    v_code := public._code_billet();
    exit when not exists (select 1 from public.billets b where b.code = v_code);
  end loop;
  insert into public.billets (inscription_id, code, statut) values (p_inscription, v_code, 'actif');
  return v_code;
end $$;

create or replace function public.staf_valide(p_code text, p_id uuid) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur']); r public.inscriptions; t public.types_billets; v_code text;
begin
  select * into r from public.inscriptions where id = p_id for update;
  if r.id is null then raise exception 'Enskripsyon sa a pa egziste.'; end if;
  if r.statut <> 'en_attente' then raise exception 'Enskripsyon sa a deja trete (%).', r.statut; end if;
  if r.reference_paiement is null then raise exception 'Moun nan poko voye nimewo tranzaksyon an.'; end if;
  select * into t from public.types_billets where id = r.type_billet_id for update;   -- serialises validations per ticket type
  if public._restants_type(t.id) <= 0 then raise exception 'Kota tikè « % » plen.', t.nom; end if;
  if exists (select 1 from public.inscriptions where evenement_id = r.evenement_id and statut = 'valide'
             and lower(reference_paiement) = lower(r.reference_paiement)) then
    raise exception 'Nimewo tranzaksyon % deja valide pou yon lòt moun.', r.reference_paiement; end if;
  update public.inscriptions set statut = 'valide', valide_par = s.non, valide_le = now(), motif_refus = null where id = r.id;
  v_code := public._cree_billet(r.id);
  return jsonb_build_object('ok', true, 'billet', v_code, 'nom', r.nom, 'telephone', r.telephone, 'email', r.email, 'code_court', r.code_court);
end $$;

create or replace function public.staf_refize(p_code text, p_id uuid, p_motif text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur']); r public.inscriptions;
begin
  if length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'Ekri rezon an.'; end if;
  update public.inscriptions set statut = 'refuse', motif_refus = btrim(p_motif), valide_par = s.non, valide_le = now()
    where id = p_id and statut = 'en_attente' returning * into r;
  if r.id is null then raise exception 'Enskripsyon sa a pa an atant.'; end if;
  return jsonb_build_object('ok', true, 'nom', r.nom, 'telephone', r.telephone, 'code_court', r.code_court);
end $$;

create or replace function public.staf_anile(p_code text, p_id uuid, p_ranbouse boolean default false) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin']);
begin
  update public.billets set statut = 'annule' where inscription_id = p_id;
  if p_ranbouse then update public.inscriptions set statut = 'rembourse', valide_par = s.non, valide_le = now() where id = p_id; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Cash payment: the admin creates and validates the registration in one step.
create or replace function public.staf_kach(p_code text, p_type uuid, p_nom text, p_telephone text, p_email text default null) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin']); r jsonb; v jsonb;
begin
  r := public.inscrire(p_type, p_nom, p_telephone, p_email, '{}'::jsonb, 'moncash');
  update public.inscriptions set moyen_paiement = 'especes', reference_paiement = 'KACH-' || (r->>'code_court'), soumis_le = now()
    where id = (r->>'id')::uuid;
  v := public.staf_valide(p_code, (r->>'id')::uuid);
  return v;
end $$;

-- ---------------------------------------------------------------- scanner (day of the event, works offline on the device)
create or replace function public.skane_lis(p_code text, p_evenement uuid default null) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','scanneur']); e public.evenements := public._evt(p_evenement);
begin
  return jsonb_build_object('evenement', jsonb_build_object('id', e.id, 'nom', e.nom, 'date', e.date), 'le', now(),
    'billets', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'numero', i.code_court, 'nom', i.nom,
        'tel', right(i.telephone_cle, 4), 'type', t.nom, 'statut', b.statut, 'scanne_le', b.scanne_le))
      from public.billets b join public.inscriptions i on i.id = b.inscription_id join public.types_billets t on t.id = i.type_billet_id
      where i.evenement_id = e.id), '[]'));
end $$;

-- p_scans: [{"code": "...", "le": "2026-11-28T09:12:00Z"}, ...] in the order they happened on the device.
create or replace function public.skane_sync(p_code text, p_appareil text, p_scans jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','scanneur']); x jsonb; b public.billets; le timestamptz; res text; acc jsonb := '[]';
begin
  for x in select * from jsonb_array_elements(coalesce(p_scans, '[]'::jsonb)) loop
    le := coalesce(nullif(x->>'le', '')::timestamptz, now());
    select * into b from public.billets where code = upper(x->>'code') for update;
    if b.id is null then res := 'inconnu';
    elsif b.statut = 'annule' then res := 'annule';
    elsif b.statut = 'utilise' then
      res := 'deja';
      if le < b.scanne_le then update public.billets set scanne_le = le, scanne_par = left(p_appareil, 60) where id = b.id; end if;
    else
      update public.billets set statut = 'utilise', scanne_le = le, scanne_par = left(p_appareil, 60) where id = b.id;
      res := 'valide';
    end if;
    insert into public.scans (billet_id, code, appareil, resultat, scanne_le, synchronise) values (b.id, upper(x->>'code'), left(p_appareil, 60), res, le, true);
    select * into b from public.billets where code = upper(x->>'code');
    acc := acc || jsonb_build_array(jsonb_build_object('code', upper(x->>'code'), 'resultat', res, 'statut', b.statut, 'scanne_le', b.scanne_le));
  end loop;
  return acc;
end $$;

-- ---------------------------------------------------------------- who may call what
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.evenement_public(uuid), public.inscrire(uuid, text, text, text, jsonb, text),
  public.soumettre_paiement(uuid, text, text, text, text), public.billet_public(text), public.retrouver_billet(text, text),
  public.staf_konekte(text), public.staf_kreye(text, text, text, text),
  public.staf_evenement(text, jsonb, jsonb), public.staf_tablo(text, uuid), public.staf_kapti(text, uuid),
  public.staf_valide(text, uuid), public.staf_refize(text, uuid, text), public.staf_anile(text, uuid, boolean),
  public.staf_kach(text, uuid, text, text, text), public.skane_lis(text, uuid), public.skane_sync(text, text, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------- the 28 November workshop (prices are set from /staf)
insert into public.evenements (nom, date, lieu, adresse, capacite, statut)
select 'Atelye konferans Atelye AI', '2026-11-28 10:00:00-05', 'Lise Anacaona', 'Leyogàn, Ayiti', 100, 'ouvert'
where not exists (select 1 from public.evenements where nom = 'Atelye konferans Atelye AI');
