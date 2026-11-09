-- Roles you define yourselves: a name, a description, a colour and a set of access rights.
-- Creating, changing or removing a role is a proposal; it takes effect once every active admin has approved it.
-- Permission keys replace the old hard-coded role lists. The built-in roles keep their keys, so nothing changes for current members.

create table if not exists public.wol (
  kle text primary key,                 -- stable key stored on staf.role
  non text not null,
  deskripsyon text,
  koule text not null default '#64748b',
  akse text[] not null default '{}',
  sistem boolean not null default false,  -- the super admin role cannot be changed or removed
  cree_le timestamptz default now());
create table if not exists public.wol_chanjman (
  id uuid primary key default gen_random_uuid(),
  aksyon text not null check (aksyon in ('kreye','modifye','efase')),
  wol_kle text,
  done jsonb not null default '{}',
  pwopoze_pa uuid references public.staf(id),
  apwouve uuid[] not null default '{}',
  statut text not null default 'an_atant' check (statut in ('an_atant','aplike','refize')),
  refize_pa uuid,
  cree_le timestamptz default now(),
  fini_le timestamptz);
alter table public.wol enable row level security;
alter table public.wol_chanjman enable row level security;
revoke all on public.wol, public.wol_chanjman from anon, authenticated;
alter table public.staf drop constraint if exists staf_role_ck;

insert into public.wol (kle, non, deskripsyon, koule, akse, sistem) values
 ('admin', 'Super admin', 'Gen tout aksè yo, valide manm ak wòl yo.', '#ffc83d',
   array['valide_peman','enskri_sou_plas','jwenn_tike','lis_enskripsyon','ranbouse_anile','rapel','chif','pri_evenman','eskane','jere_ekip'], true),
 ('validateur', 'Validatè', 'Verifye ak valide peman MonCash ak NatCash yo.', '#3b82f6', array['valide_peman'], false),
 ('vandeur', 'Vandè', 'Enskri moun sou plas epi revoye tikè ki pèdi.', '#22c55e', array['enskri_sou_plas','jwenn_tike'], false),
 ('scanneur', 'Eskanè', 'Eskane tikè yo nan pòt la jou atelye a.', '#f97316', array['eskane'], false),
 ('asistan', 'Asistan', 'Ede ekip la jou atelye a: akèy ak oryantasyon.', '#a855f7', '{}', false)
on conflict (kle) do nothing;

-- what each access right means, in plain words
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
    else p end
$$;
create or replace function public._akse_tout() returns text[] language sql immutable as $$
  select array['valide_peman','enskri_sou_plas','jwenn_tike','lis_enskripsyon','ranbouse_anile','rapel','chif','pri_evenman','eskane','jere_ekip']
$$;
create or replace function public._pe(p_role text, p_akse text) returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.wol w where w.kle = p_role and (w.sistem or p_akse = any (w.akse)))
$$;
create or replace function public._akse(p_role text) returns jsonb language sql stable set search_path = public as $$
  select coalesce((select jsonb_agg(public._akse_non(a)) from public.wol w, unnest(case when w.sistem then public._akse_tout() else w.akse end) a where w.kle = p_role), '[]'::jsonb)
$$;

-- p_code is a session token or an old staff code; p_akse null = any active member
create or replace function public._staf_a(p_code text, p_akse text) returns public.staf language plpgsql stable
set search_path = public, extensions as $$
declare s public.staf;
begin
  select st.* into s from public.staf_sesyon x join public.staf st on st.id = x.staf_id
    where x.token_hash = encode(digest(coalesce(p_code, ''), 'sha256'), 'hex') and x.expire > now() and st.actif and st.statut = 'actif';
  if s.id is null then
    select * into s from public.staf where actif and statut = 'actif' and code_hash is not null
      and code_hash = crypt(coalesce(p_code, ''), code_hash) limit 1;
  end if;
  if s.id is null or s.role is null or not exists (select 1 from public.wol where kle = s.role)
     or (p_akse is not null and not public._pe(s.role, p_akse)) then
    raise exception 'Kòd la pa bon oswa ou pa gen aksè.' using errcode = '28000'; end if;
  return s;
end $$;

create or replace function public.staf_konekte(p_code text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null);
begin
  return jsonb_build_object('non', s.non, 'role', s.role, 'evenement', public.evenement_public(null));
end $$;

create or replace function public.staf_kreye(p_code text, p_non text, p_role text, p_nouvo_code text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip');
begin
  if not exists (select 1 from public.wol where kle = p_role) then raise exception 'Wòl la pa bon.'; end if;
  if length(coalesce(p_nouvo_code, '')) < 10 then raise exception 'Kòd la dwe gen omwen 10 karaktè.'; end if;
  insert into public.staf (non, role, code_hash) values (btrim(p_non), p_role, crypt(p_nouvo_code, gen_salt('bf', 10)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_evenement(p_code text, p_evenement jsonb, p_types jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'pri_evenman'); eid uuid := nullif(p_evenement->>'id', '')::uuid; t jsonb;
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

create or replace function public.staf_kapti(p_code text, p_id uuid) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'valide_peman'); c public.captures;
begin
  select * into c from public.captures where inscription_id = p_id and image is not null;
  if c.inscription_id is null then return null; end if;
  return jsonb_build_object('type', c.type, 'data', encode(c.image, 'base64'));
end $$;

create or replace function public.staf_refize(p_code text, p_id uuid, p_motif text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'valide_peman'); r public.inscriptions;
begin
  if length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'Ekri rezon an.'; end if;
  update public.inscriptions set statut = 'refuse', motif_refus = btrim(p_motif), valide_par = s.non, valide_le = now()
    where id = p_id and statut = 'en_attente' returning * into r;
  if r.id is null then raise exception 'Enskripsyon sa a pa an atant.'; end if;
  return jsonb_build_object('ok', true, 'nom', r.nom, 'telephone', r.telephone, 'code_court', r.code_court);
end $$;

create or replace function public.staf_anile(p_code text, p_id uuid, p_ranbouse boolean default false) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'ranbouse_anile');
begin
  update public.billets set statut = 'annule' where inscription_id = p_id;
  if p_ranbouse then update public.inscriptions set statut = 'rembourse', valide_par = s.non, valide_le = now() where id = p_id; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_kach(p_code text, p_type uuid, p_nom text, p_telephone text, p_email text default null) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'enskri_sou_plas'); r jsonb; v jsonb;
begin
  r := public.inscrire(p_type, p_nom, p_telephone, p_email, '{}'::jsonb, 'moncash');
  update public.inscriptions set moyen_paiement = 'especes', reference_paiement = 'KACH-' || (r->>'code_court'), soumis_le = now()
    where id = (r->>'id')::uuid;
  v := public.staf_valide(p_code, (r->>'id')::uuid);
  return v;
end $$;

create or replace function public.skane_lis(p_code text, p_evenement uuid default null) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'eskane'); e public.evenements := public._evt(p_evenement);
begin
  return jsonb_build_object('evenement', jsonb_build_object('id', e.id, 'nom', e.nom, 'date', e.date), 'le', now(),
    'billets', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'numero', i.code_court, 'nom', i.nom,
        'tel', right(i.telephone_cle, 4), 'type', t.nom, 'statut', b.statut, 'scanne_le', b.scanne_le))
      from public.billets b join public.inscriptions i on i.id = b.inscription_id join public.types_billets t on t.id = i.type_billet_id
      where i.evenement_id = e.id), '[]'));
end $$;

create or replace function public.skane_sync(p_code text, p_appareil text, p_scans jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'eskane'); x jsonb; b public.billets; le timestamptz; res text; acc jsonb := '[]';
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

create or replace function public.staf_foto(p_code text, p_foto text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null);
begin
  if p_foto is null or length(p_foto) > 300000 then raise exception 'Foto a pa bon oswa twò lou.'; end if;
  update public.staf set foto = p_foto where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_mete_kont(p_code text, p_idantifyan text, p_modpas text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); v_id text := public._idantifyan(p_idantifyan);
begin
  if length(coalesce(p_modpas, '')) < 8 then raise exception 'Modpas la dwe gen omwen 8 karaktè.'; end if;
  if exists (select 1 from public.staf where idantifyan = v_id and id <> s.id) then raise exception 'Nimewo oswa imèl sa a deja itilize.'; end if;
  update public.staf set idantifyan = v_id, modpas_hash = crypt(p_modpas, gen_salt('bf', 10)) where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_valide(p_code text, p_id uuid) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); r public.inscriptions; t public.types_billets; v_code text;
begin
  select * into r from public.inscriptions where id = p_id for update;
  if r.id is null then raise exception 'Enskripsyon sa a pa egziste.'; end if;
  if not (public._pe(s.role, 'valide_peman') or (public._pe(s.role, 'enskri_sou_plas') and r.moyen_paiement = 'especes')) then
    raise exception 'Ou pa gen aksè.' using errcode = '28000'; end if;
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

-- dashboard data: each part only for those who have the matching access
create or replace function public.staf_tablo(p_code text, p_evenement uuid default null) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); e public.evenements := public._evt(p_evenement); res jsonb;
begin
  if e.id is null then return jsonb_build_object('role', s.role, 'non', s.non, 'evenement', null, 'file', '[]'::jsonb, 'lis', '[]'::jsonb, 'types', '[]'::jsonb); end if;
  res := jsonb_build_object('role', s.role, 'non', s.non, 'evenement', to_jsonb(e), 'file', '[]'::jsonb, 'lis', '[]'::jsonb,
    'types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nom', t.nom, 'prix_usd', t.prix_usd, 'prix_htg', t.prix_htg, 'quota', t.quota,
        'date_fin_vente', t.date_fin_vente, 'ordre', t.ordre, 'avantaj', coalesce(t.avantaj, '[]'::jsonb), 'restants', public._restants_type(t.id), 'bloke', public._bloke(t.id)) order by t.ordre, t.prix_htg)
      from public.types_billets t where t.evenement_id = e.id), '[]'));
  if public._pe(s.role, 'chif') then
    res := res || jsonb_build_object(
      'chif', (select jsonb_build_object(
        'inscrits', count(*) filter (where statut <> 'refuse'),
        'payes', count(*) filter (where statut = 'valide'),
        'en_attente', count(*) filter (where statut = 'en_attente' and reference_paiement is not null),
        'sans_paiement', count(*) filter (where statut = 'en_attente' and reference_paiement is null),
        'refuses', count(*) filter (where statut = 'refuse'),
        'recettes_htg', coalesce(sum(montant) filter (where statut = 'valide'), 0))
        from public.inscriptions where evenement_id = e.id),
      'par_jour', coalesce((select jsonb_agg(jsonb_build_object('jour', d, 'n', n) order by d)
        from (select (cree_le at time zone 'America/Port-au-Prince')::date d, count(*) n from public.inscriptions
              where evenement_id = e.id group by 1) x), '[]'),
      'jour_j', (select jsonb_build_object('entres', count(*) filter (where b.statut = 'utilise'), 'attendus', count(*) filter (where b.statut <> 'annule'))
        from public.billets b join public.inscriptions i on i.id = b.inscription_id where i.evenement_id = e.id));
  end if;
  if public._pe(s.role, 'valide_peman') then
    res := res || jsonb_build_object('file', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'code_court', i.code_court, 'nom', i.nom, 'telephone', i.telephone,
        'type', t.nom, 'montant', i.montant, 'moyen', i.moyen_paiement, 'reference', i.reference_paiement, 'soumis_le', i.soumis_le,
        'capture', exists (select 1 from public.captures c where c.inscription_id = i.id and c.image is not null)) order by i.soumis_le)
      from public.inscriptions i join public.types_billets t on t.id = i.type_billet_id
      where i.evenement_id = e.id and i.statut = 'en_attente' and i.reference_paiement is not null), '[]'));
  end if;
  if public._pe(s.role, 'lis_enskripsyon') then
    res := res || jsonb_build_object('lis', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'code_court', i.code_court, 'nom', i.nom, 'telephone', i.telephone,
          'email', i.email, 'type', t.nom, 'montant', i.montant, 'moyen', i.moyen_paiement, 'reference', i.reference_paiement,
          'statut', i.statut, 'motif', i.motif_refus, 'reponses', i.reponses, 'cree_le', i.cree_le, 'valide_le', i.valide_le, 'valide_par', i.valide_par,
          'billet', b.code, 'billet_statut', b.statut, 'scanne_le', b.scanne_le) order by i.cree_le desc)
        from public.inscriptions i join public.types_billets t on t.id = i.type_billet_id left join public.billets b on b.inscription_id = i.id
        where i.evenement_id = e.id), '[]'));
  elsif public._pe(s.role, 'jwenn_tike') or public._pe(s.role, 'rapel') then
    res := res || jsonb_build_object('lis', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'code_court', i.code_court, 'nom', i.nom, 'telephone', i.telephone,
          'type', t.nom, 'statut', i.statut, 'valide_par', i.valide_par, 'billet', b.code, 'billet_statut', b.statut, 'scanne_le', b.scanne_le) order by i.cree_le desc)
        from public.inscriptions i join public.types_billets t on t.id = i.type_billet_id left join public.billets b on b.inscription_id = i.id
        where i.evenement_id = e.id and i.statut = 'valide'), '[]'));
  end if;
  return res;
end $$;

create or replace function public.staf_mwen(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); w public.wol; e public.evenements := public._evt(null);
begin
  select * into w from public.wol where kle = s.role;
  return jsonb_build_object('id', s.id, 'non', s.non, 'role', s.role, 'role_non', w.non, 'role_desk', w.deskripsyon, 'koule', w.koule,
    'fonksyon', s.fonksyon, 'travay', s.travay, 'foto', s.foto, 'badj', s.badj, 'idantifyan', s.idantifyan, 'depi', s.cree_le,
    'akse', public._akse(s.role), 'akse_kle', to_jsonb(case when w.sistem then public._akse_tout() else w.akse end),
    'evenement', case when e.id is null then null else jsonb_build_object('nom', e.nom, 'date', e.date, 'lieu', e.lieu) end);
end $$;

create or replace function public.staf_ekip(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'non', st.non, 'role', st.role, 'role_non', w.non, 'koule', w.koule, 'statut', st.statut,
      'fonksyon', st.fonksyon, 'travay', st.travay, 'foto', st.foto, 'badj', st.badj, 'idantifyan', st.idantifyan, 'cree_le', st.cree_le, 'mwen', st.id = s.id)
    order by (st.statut = 'en_attente') desc, st.cree_le desc) from public.staf st left join public.wol w on w.kle = st.role), '[]'::jsonb);
end $$;

create or replace function public.staf_ekip_mete(p_code text, p_id uuid, p_statut text, p_role text, p_fonksyon text, p_travay text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip');
begin
  if p_statut not in ('actif','refuse','dezaktive') then raise exception 'Estati a pa bon.'; end if;
  if p_statut = 'actif' and not exists (select 1 from public.wol where kle = p_role) then raise exception 'Chwazi yon wòl.'; end if;
  if p_id = s.id and p_statut <> 'actif' then raise exception 'Ou pa ka dezaktive pwòp kont ou.'; end if;
  if p_id = s.id and p_role is distinct from s.role then raise exception 'Yon lòt admin dwe chanje wòl ou.'; end if;
  -- only a super admin can make someone a super admin
  if p_role = 'admin' and s.role <> 'admin' then raise exception 'Se yon super admin sèlman ki ka nonmen yon super admin.'; end if;
  update public.staf set statut = p_statut, role = coalesce(p_role, role), fonksyon = nullif(btrim(coalesce(p_fonksyon, '')), ''),
    travay = nullif(btrim(coalesce(p_travay, '')), '') where id = p_id;
  if p_statut <> 'actif' then update public.staf_sesyon set expire = now() where staf_id = p_id; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.badj_public(p_badj text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.staf; w public.wol;
begin
  select * into s from public.staf where badj = upper(btrim(coalesce(p_badj, '')));
  if s.id is null then return null; end if;
  select * into w from public.wol where kle = s.role;
  return jsonb_build_object('non', s.non, 'role', s.role, 'role_non', w.non, 'koule', w.koule, 'fonksyon', s.fonksyon, 'foto', s.foto,
    'badj', s.badj, 'depi', s.cree_le, 'valid', s.actif and s.statut = 'actif');
end $$;

-- ---------------------------------------------------------------- roles and their approval
create or replace function public._wol_aplike(p_id uuid) returns void language plpgsql volatile set search_path = public as $$
declare c public.wol_chanjman; k text;
begin
  select * into c from public.wol_chanjman where id = p_id for update;
  if c.aksyon = 'kreye' then
    k := coalesce(c.wol_kle, 'w_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into public.wol (kle, non, deskripsyon, koule, akse) values (k, c.done->>'non', c.done->>'deskripsyon', coalesce(c.done->>'koule', '#64748b'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(c.done->'akse') x where x = any (public._akse_tout())), '{}'));
    update public.wol_chanjman set wol_kle = k where id = p_id;
  elsif c.aksyon = 'modifye' then
    update public.wol set non = c.done->>'non', deskripsyon = c.done->>'deskripsyon', koule = coalesce(c.done->>'koule', koule),
      akse = coalesce((select array_agg(x) from jsonb_array_elements_text(c.done->'akse') x where x = any (public._akse_tout())), '{}')
      where kle = c.wol_kle and not sistem;
  elsif c.aksyon = 'efase' then
    if exists (select 1 from public.staf where role = c.wol_kle and statut in ('actif','en_attente')) then
      raise exception 'Gen manm ki toujou gen wòl sa a. Ba yo yon lòt wòl anvan.'; end if;
    update public.wol set akse = '{}', non = non || ' (retire)' where kle = c.wol_kle and not sistem;
  end if;
  update public.wol_chanjman set statut = 'aplike', fini_le = now() where id = p_id;
end $$;

-- applies when every active super admin has approved
create or replace function public._wol_tcheke(p_id uuid) returns text language plpgsql volatile set search_path = public as $$
declare c public.wol_chanjman;
begin
  select * into c from public.wol_chanjman where id = p_id;
  if not exists (select 1 from public.staf a where a.role = 'admin' and a.actif and a.statut = 'actif' and not (a.id = any (c.apwouve))) then
    perform public._wol_aplike(p_id); return 'aplike';
  end if;
  return 'an_atant';
end $$;

create or replace function public.staf_wol(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip'); n_admin int;
begin
  select count(*) into n_admin from public.staf where role = 'admin' and actif and statut = 'actif';
  return jsonb_build_object(
    'admin', s.role = 'admin', 'n_admin', n_admin,
    'katalog', (select jsonb_agg(jsonb_build_object('kle', a, 'non', public._akse_non(a))) from unnest(public._akse_tout()) a),
    'wol', coalesce((select jsonb_agg(jsonb_build_object('kle', w.kle, 'non', w.non, 'deskripsyon', w.deskripsyon, 'koule', w.koule, 'sistem', w.sistem,
        'akse', to_jsonb(case when w.sistem then public._akse_tout() else w.akse end),
        'manm', (select count(*) from public.staf st where st.role = w.kle and st.statut = 'actif')) order by w.sistem desc, w.cree_le)
      from public.wol w where w.non not like '% (retire)'), '[]'::jsonb),
    'chanjman', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'aksyon', c.aksyon, 'wol_kle', c.wol_kle, 'done', c.done, 'statut', c.statut,
        'pwopoze_pa', (select non from public.staf where id = c.pwopoze_pa),
        'apwouve', (select coalesce(jsonb_agg(non), '[]'::jsonb) from public.staf where id = any (c.apwouve)),
        'mwen_apwouve', s.id = any (c.apwouve), 'cree_le', c.cree_le) order by c.cree_le desc)
      from public.wol_chanjman c where c.statut = 'an_atant' or c.fini_le > now() - interval '7 days'), '[]'::jsonb));
end $$;

create or replace function public.staf_wol_pwopoze(p_code text, p_aksyon text, p_kle text, p_done jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip'); v_id uuid; v_non text := btrim(coalesce(p_done->>'non', ''));
begin
  if p_aksyon not in ('kreye','modifye','efase') then raise exception 'Aksyon an pa bon.'; end if;
  if p_aksyon <> 'efase' and (length(v_non) < 2 or length(v_non) > 40) then raise exception 'Bay wòl la yon non (2 a 40 karaktè).'; end if;
  if length(coalesce(p_done->>'deskripsyon', '')) > 300 then raise exception 'Deskripsyon an twò long.'; end if;
  if coalesce(p_done->>'koule', '#000000') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Koulè a pa bon.'; end if;
  if p_aksyon <> 'kreye' and not exists (select 1 from public.wol where kle = p_kle and not sistem) then raise exception 'Ou pa ka chanje wòl sa a.'; end if;
  if exists (select 1 from public.wol_chanjman where statut = 'an_atant' and wol_kle = p_kle and p_aksyon <> 'kreye') then
    raise exception 'Gen yon chanjman k ap tann deja pou wòl sa a.'; end if;
  insert into public.wol_chanjman (aksyon, wol_kle, done, pwopoze_pa, apwouve)
    values (p_aksyon, case when p_aksyon = 'kreye' then null else p_kle end,
      jsonb_build_object('non', v_non, 'deskripsyon', btrim(coalesce(p_done->>'deskripsyon', '')), 'koule', coalesce(p_done->>'koule', '#64748b'),
        'akse', coalesce(p_done->'akse', '[]'::jsonb)),
      s.id, case when s.role = 'admin' then array[s.id] else '{}' end) returning id into v_id;
  return jsonb_build_object('ok', true, 'statut', public._wol_tcheke(v_id));
end $$;

create or replace function public.staf_wol_vote(p_code text, p_id uuid, p_dakò boolean) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip'); c public.wol_chanjman;
begin
  if s.role <> 'admin' then raise exception 'Se super admin yo sèlman ki valide chanjman wòl yo.'; end if;
  select * into c from public.wol_chanjman where id = p_id for update;
  if c.id is null or c.statut <> 'an_atant' then raise exception 'Chanjman sa a pa an atant ankò.'; end if;
  if not p_dakò then
    update public.wol_chanjman set statut = 'refize', refize_pa = s.id, fini_le = now() where id = p_id;
    return jsonb_build_object('ok', true, 'statut', 'refize');
  end if;
  update public.wol_chanjman set apwouve = array(select distinct unnest(apwouve || s.id)) where id = p_id;
  return jsonb_build_object('ok', true, 'statut', public._wol_tcheke(p_id));
end $$;

revoke execute on function public._akse_non(text), public._akse_tout(), public._pe(text, text), public._akse(text), public._staf_a(text, text),
  public._wol_aplike(uuid), public._wol_tcheke(uuid) from public, anon, authenticated;
grant execute on function public.staf_wol(text), public.staf_wol_pwopoze(text, text, text, jsonb), public.staf_wol_vote(text, uuid, boolean),
  public.staf_konekte(text), public.staf_kreye(text, text, text, text), public.staf_evenement(text, jsonb, jsonb), public.staf_tablo(text, uuid),
  public.staf_kapti(text, uuid), public.staf_valide(text, uuid), public.staf_refize(text, uuid, text), public.staf_anile(text, uuid, boolean),
  public.staf_kach(text, uuid, text, text, text), public.skane_lis(text, uuid), public.skane_sync(text, text, jsonb),
  public.staf_mwen(text), public.staf_foto(text, text), public.staf_mete_kont(text, text, text), public.staf_ekip(text),
  public.staf_ekip_mete(text, uuid, text, text, text, text), public.badj_public(text)
  to anon, authenticated;
