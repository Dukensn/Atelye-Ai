-- Team tools: projects with themed lists (an item is a task), announcements (to everyone, a role or one person; a future date
-- schedules them), shared documents, and a knowledge base read by both the WhatsApp assistant and the team assistant.

create table if not exists public.ekip_pwoje (
  id uuid primary key default gen_random_uuid(),
  tit text not null,
  deskripsyon text,
  achive boolean not null default false,
  kreye_pa uuid references public.staf(id) on delete set null,
  kreye_le timestamptz default now());

create table if not exists public.ekip_lis (
  id uuid primary key default gen_random_uuid(),
  pwoje_id uuid not null references public.ekip_pwoje(id) on delete cascade,
  tit text not null,
  ordre int not null default 0,
  kreye_le timestamptz default now());

create table if not exists public.ekip_travay (
  id uuid primary key default gen_random_uuid(),
  lis_id uuid references public.ekip_lis(id) on delete cascade,      -- null = a task outside any project
  tit text not null,
  nota text,
  moun uuid references public.staf(id) on delete set null,           -- who does it
  dat date,                                                          -- due date
  montan numeric(12, 2),                                             -- for expense lists
  fini boolean not null default false,
  fini_le timestamptz,
  ordre int not null default 0,
  kreye_pa uuid references public.staf(id) on delete set null,
  kreye_le timestamptz default now());

create table if not exists public.ekip_anons (
  id uuid primary key default gen_random_uuid(),
  tit text not null,
  kontni text not null default '',
  pou text not null default 'tout',                                  -- 'tout', 'wol:<role key>' or 'moun:<staff id>'
  pibliye_le timestamptz not null default now(),                     -- in the future = scheduled
  epeng boolean not null default false,
  kreye_pa uuid references public.staf(id) on delete set null,
  kreye_le timestamptz default now());

create table if not exists public.ekip_dokiman (
  id uuid primary key default gen_random_uuid(),
  tit text not null,
  kontni text not null default '',
  kreye_pa uuid references public.staf(id) on delete set null,
  modifye_pa uuid references public.staf(id) on delete set null,
  kreye_le timestamptz default now(),
  modifye_le timestamptz default now());

create table if not exists public.baz_konesans (
  id uuid primary key default gen_random_uuid(),
  tit text not null,
  kontni text not null,
  pou text not null default 'tou_de' check (pou in ('wa', 'ekip', 'tou_de')),
  modifye_pa uuid references public.staf(id) on delete set null,
  modifye_le timestamptz default now());

alter table public.staf add column if not exists anons_vi timestamptz;   -- last time this member opened the announcements

create index if not exists ekip_pwoje_kreye_pa on public.ekip_pwoje (kreye_pa);
create index if not exists ekip_lis_pwoje on public.ekip_lis (pwoje_id);
create index if not exists ekip_travay_lis on public.ekip_travay (lis_id);
create index if not exists ekip_travay_moun on public.ekip_travay (moun);
create index if not exists ekip_travay_kreye_pa on public.ekip_travay (kreye_pa);
create index if not exists ekip_anons_kreye_pa on public.ekip_anons (kreye_pa);
create index if not exists ekip_anons_dat on public.ekip_anons (pibliye_le desc);
create index if not exists ekip_dokiman_kreye_pa on public.ekip_dokiman (kreye_pa);
create index if not exists ekip_dokiman_modifye_pa on public.ekip_dokiman (modifye_pa);
create index if not exists baz_konesans_modifye_pa on public.baz_konesans (modifye_pa);

alter table public.ekip_pwoje enable row level security;
alter table public.ekip_lis enable row level security;
alter table public.ekip_travay enable row level security;
alter table public.ekip_anons enable row level security;
alter table public.ekip_dokiman enable row level security;
alter table public.baz_konesans enable row level security;
revoke all on public.ekip_pwoje, public.ekip_lis, public.ekip_travay, public.ekip_anons, public.ekip_dokiman, public.baz_konesans from anon, authenticated;

-- two new access rights: publish announcements, edit the knowledge base
create or replace function public._akse_non(p text) returns text language sql immutable set search_path = public as $$
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
    when 'anons' then 'Pibliye ak pwograme anons pou ekip la'
    when 'konesans' then 'Modifye baz konesans asistan yo'
    else p end
$$;
create or replace function public._akse_tout() returns text[] language sql immutable set search_path = public as $$
  select array['valide_peman','enskri_sou_plas','jwenn_tike','lis_enskripsyon','ranbouse_anile','rapel','chif','pri_evenman','eskane','jere_ekip','whatsapp','anons','konesans']
$$;

create or replace function public._anons_pou(s public.staf, a public.ekip_anons) returns boolean language sql stable set search_path = public as $$
  select a.pou = 'tout' or a.pou = 'wol:' || coalesce(s.role, '') or a.pou = 'moun:' || s.id::text or a.kreye_pa = s.id
$$;
create or replace function public._uuid(p text) returns uuid language plpgsql immutable set search_path = public as $$
begin
  if btrim(coalesce(p, '')) = '' then return null; end if;
  return p::uuid;
exception when others then raise exception 'Idantifyan an pa bon.';
end $$;

-- everything the team tools show, in one call
create or replace function public.staf_zouti(p_code text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); pa boolean := public._pe(s.role, 'anons');
begin
  return jsonb_build_object(
    'mwen', s.id, 'pe_anons', pa, 'pe_konesans', public._pe(s.role, 'konesans'), 'pe_jere', public._pe(s.role, 'jere_ekip'),
    'manm', coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'non', st.non, 'role', st.role, 'foto', st.foto is not null) order by st.non)
      from public.staf st where st.statut = 'actif' and st.actif), '[]'),
    'wol', coalesce((select jsonb_agg(jsonb_build_object('kle', w.kle, 'non', w.non) order by w.non) from public.wol w), '[]'),
    'pwoje', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'tit', p.tit, 'deskripsyon', p.deskripsyon, 'achive', p.achive, 'kreye_pa', p.kreye_pa, 'kreye_le', p.kreye_le,
        'lis', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'tit', l.tit, 'ordre', l.ordre) order by l.ordre, l.kreye_le) from public.ekip_lis l where l.pwoje_id = p.id), '[]'))
      order by p.achive, p.kreye_le desc) from public.ekip_pwoje p), '[]'),
    'travay', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'lis_id', t.lis_id, 'tit', t.tit, 'nota', t.nota, 'moun', t.moun, 'dat', t.dat,
        'montan', t.montan, 'fini', t.fini, 'ordre', t.ordre, 'kreye_pa', t.kreye_pa, 'kreye_le', t.kreye_le) order by t.fini, t.ordre, t.kreye_le)
      from public.ekip_travay t), '[]'),
    'anons', coalesce((select jsonb_agg(x order by (x->>'epeng')::boolean desc, x->>'pibliye_le' desc) from (
        select jsonb_build_object('id', a.id, 'tit', a.tit, 'kontni', a.kontni, 'pou', a.pou, 'pibliye_le', a.pibliye_le, 'epeng', a.epeng,
          'pa', st.non, 'pa_id', a.kreye_pa, 'pwograme', a.pibliye_le > now(),
          'nouvo', a.pibliye_le <= now() and a.pibliye_le > coalesce(s.anons_vi, '-infinity'::timestamptz) and a.kreye_pa is distinct from s.id) x
        from public.ekip_anons a left join public.staf st on st.id = a.kreye_pa
        where (a.pibliye_le <= now() and public._anons_pou(s, a)) or (pa and a.pibliye_le > now())
        order by a.pibliye_le desc limit 150) y), '[]'),
    'dokiman', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'tit', d.tit, 'ekstre', left(regexp_replace(d.kontni, '\s+', ' ', 'g'), 140),
        'modifye_le', d.modifye_le, 'pa', st.non) order by d.modifye_le desc)
      from public.ekip_dokiman d left join public.staf st on st.id = d.modifye_pa), '[]'));
end $$;

create or replace function public.staf_travay_mete(p_code text, p jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); t public.ekip_travay; v_id uuid := public._uuid(p->>'id');
  v_lis uuid := public._uuid(p->>'lis_id'); v_moun uuid := public._uuid(p->>'moun'); v_tit text; v_m numeric;
begin
  if v_id is not null then
    select * into t from public.ekip_travay where id = v_id for update;
    if t.id is null then raise exception 'Travay sa a pa egziste ankò.'; end if;
  end if;
  if coalesce((p->>'efase')::boolean, false) then
    if t.id is null then raise exception 'Travay sa a pa egziste ankò.'; end if;
    if t.kreye_pa is distinct from s.id and t.moun is distinct from s.id and not public._pe(s.role, 'jere_ekip') then
      raise exception 'Se moun ki kreye l la oswa moun ki gen l lan ki ka efase l.'; end if;
    delete from public.ekip_travay where id = t.id;
    return jsonb_build_object('ok', true);
  end if;
  v_tit := btrim(coalesce(p->>'tit', t.tit, ''));
  if length(v_tit) < 1 or length(v_tit) > 300 then raise exception 'Ekri travay la (300 karaktè maksimòm).'; end if;
  if v_moun is not null and not exists (select 1 from public.staf where id = v_moun and statut = 'actif') then raise exception 'Manm sa a pa nan ekip la.'; end if;
  if v_lis is not null and not exists (select 1 from public.ekip_lis where id = v_lis) then raise exception 'Lis sa a pa egziste ankò.'; end if;
  if nullif(btrim(coalesce(p->>'montan', '')), '') is not null then
    begin v_m := replace(replace(p->>'montan', ' ', ''), ',', '.')::numeric; exception when others then raise exception 'Montan an pa bon.'; end;
    if v_m < 0 or v_m > 100000000 then raise exception 'Montan an pa bon.'; end if;
  end if;
  if t.id is null then
    insert into public.ekip_travay (lis_id, tit, nota, moun, dat, montan, fini, fini_le, ordre, kreye_pa)
    values (v_lis, v_tit, nullif(btrim(coalesce(p->>'nota', '')), ''), v_moun, nullif(p->>'dat', '')::date, v_m,
      coalesce((p->>'fini')::boolean, false), case when coalesce((p->>'fini')::boolean, false) then now() end,
      coalesce((p->>'ordre')::int, (select coalesce(max(ordre), 0) + 1 from public.ekip_travay where lis_id is not distinct from v_lis)), s.id)
    returning * into t;
  else
    update public.ekip_travay set tit = v_tit,
      nota = case when p ? 'nota' then nullif(btrim(coalesce(p->>'nota', '')), '') else nota end,
      moun = case when p ? 'moun' then v_moun else moun end,
      dat = case when p ? 'dat' then nullif(p->>'dat', '')::date else dat end,
      montan = case when p ? 'montan' then v_m else montan end,
      lis_id = case when p ? 'lis_id' then v_lis else lis_id end,
      fini_le = case when not (p ? 'fini') then fini_le when (p->>'fini')::boolean then coalesce(fini_le, now()) else null end,
      fini = case when p ? 'fini' then (p->>'fini')::boolean else fini end,
      ordre = coalesce((p->>'ordre')::int, ordre)
    where id = t.id returning * into t;
  end if;
  return jsonb_build_object('ok', true, 'id', t.id);
end $$;

create or replace function public.staf_pwoje_mete(p_code text, p jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); r public.ekip_pwoje; v_id uuid := public._uuid(p->>'id'); v_tit text; l text; i int := 0;
begin
  if v_id is not null then
    select * into r from public.ekip_pwoje where id = v_id for update;
    if r.id is null then raise exception 'Pwojè sa a pa egziste ankò.'; end if;
  end if;
  if coalesce((p->>'efase')::boolean, false) then
    if r.id is null then raise exception 'Pwojè sa a pa egziste ankò.'; end if;
    if r.kreye_pa is distinct from s.id and not public._pe(s.role, 'jere_ekip') then raise exception 'Se moun ki kreye pwojè a ki ka efase l.'; end if;
    delete from public.ekip_pwoje where id = r.id;
    return jsonb_build_object('ok', true);
  end if;
  v_tit := btrim(coalesce(p->>'tit', r.tit, ''));
  if length(v_tit) < 2 or length(v_tit) > 120 then raise exception 'Bay pwojè a yon non.'; end if;
  if r.id is null then
    insert into public.ekip_pwoje (tit, deskripsyon, kreye_pa) values (v_tit, nullif(btrim(coalesce(p->>'deskripsyon', '')), ''), s.id) returning * into r;
    for l in select btrim(x) from jsonb_array_elements_text(coalesce(p->'lis', '[]'::jsonb)) x loop
      if l <> '' then i := i + 1; insert into public.ekip_lis (pwoje_id, tit, ordre) values (r.id, left(l, 80), i); end if;
    end loop;
  else
    update public.ekip_pwoje set tit = v_tit,
      deskripsyon = case when p ? 'deskripsyon' then nullif(btrim(coalesce(p->>'deskripsyon', '')), '') else deskripsyon end,
      achive = coalesce((p->>'achive')::boolean, achive)
    where id = r.id returning * into r;
  end if;
  return jsonb_build_object('ok', true, 'id', r.id);
end $$;

create or replace function public.staf_lis_mete(p_code text, p jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); l public.ekip_lis; v_id uuid := public._uuid(p->>'id'); v_pj uuid := public._uuid(p->>'pwoje_id'); v_tit text;
begin
  if v_id is not null then
    select * into l from public.ekip_lis where id = v_id for update;
    if l.id is null then raise exception 'Lis sa a pa egziste ankò.'; end if;
  end if;
  if coalesce((p->>'efase')::boolean, false) then
    if l.id is null then raise exception 'Lis sa a pa egziste ankò.'; end if;
    delete from public.ekip_lis where id = l.id;
    return jsonb_build_object('ok', true);
  end if;
  v_tit := btrim(coalesce(p->>'tit', l.tit, ''));
  if length(v_tit) < 1 or length(v_tit) > 80 then raise exception 'Bay lis la yon non.'; end if;
  if l.id is null then
    if v_pj is null or not exists (select 1 from public.ekip_pwoje where id = v_pj) then raise exception 'Pwojè sa a pa egziste ankò.'; end if;
    insert into public.ekip_lis (pwoje_id, tit, ordre) values (v_pj, v_tit, (select coalesce(max(ordre), 0) + 1 from public.ekip_lis where pwoje_id = v_pj)) returning * into l;
  else
    update public.ekip_lis set tit = v_tit, ordre = coalesce((p->>'ordre')::int, ordre) where id = l.id returning * into l;
  end if;
  return jsonb_build_object('ok', true, 'id', l.id);
end $$;

create or replace function public.staf_anons_mete(p_code text, p jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'anons'); a public.ekip_anons; v_id uuid := public._uuid(p->>'id');
  v_tit text; v_pou text := coalesce(nullif(btrim(coalesce(p->>'pou', '')), ''), 'tout'); v_dat timestamptz;
begin
  if v_id is not null then
    select * into a from public.ekip_anons where id = v_id for update;
    if a.id is null then raise exception 'Anons sa a pa egziste ankò.'; end if;
  end if;
  if coalesce((p->>'efase')::boolean, false) then
    if a.id is null then raise exception 'Anons sa a pa egziste ankò.'; end if;
    delete from public.ekip_anons where id = a.id;
    return jsonb_build_object('ok', true);
  end if;
  v_tit := btrim(coalesce(p->>'tit', a.tit, ''));
  if length(v_tit) < 2 or length(v_tit) > 160 then raise exception 'Bay anons lan yon tit.'; end if;
  if length(coalesce(p->>'kontni', '')) > 20000 then raise exception 'Anons lan twò long.'; end if;
  if not (v_pou = 'tout'
      or (v_pou like 'wol:%' and exists (select 1 from public.wol where kle = substr(v_pou, 5)))
      or (v_pou like 'moun:%' and exists (select 1 from public.staf where id::text = substr(v_pou, 6) and statut = 'actif'))) then
    raise exception 'Chwazi pou ki moun anons lan ye.'; end if;
  begin v_dat := coalesce(nullif(p->>'pibliye_le', '')::timestamptz, now()); exception when others then raise exception 'Dat la pa bon.'; end;
  if a.id is null then
    insert into public.ekip_anons (tit, kontni, pou, pibliye_le, epeng, kreye_pa)
    values (v_tit, coalesce(p->>'kontni', ''), v_pou, v_dat, coalesce((p->>'epeng')::boolean, false), s.id) returning * into a;
  else
    update public.ekip_anons set tit = v_tit, kontni = coalesce(p->>'kontni', kontni), pou = v_pou,
      pibliye_le = case when p ? 'pibliye_le' then v_dat else pibliye_le end, epeng = coalesce((p->>'epeng')::boolean, epeng)
    where id = a.id returning * into a;
  end if;
  return jsonb_build_object('ok', true, 'id', a.id, 'pwograme', a.pibliye_le > now());
end $$;

create or replace function public.staf_anons_vi(p_code text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null);
begin
  update public.staf set anons_vi = now() where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_dokiman(p_code text, p_id uuid) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); r jsonb;
begin
  select jsonb_build_object('id', d.id, 'tit', d.tit, 'kontni', d.kontni, 'kreye_le', d.kreye_le, 'modifye_le', d.modifye_le,
      'pa', m.non, 'kreyate', k.non, 'pe_efase', d.kreye_pa = s.id or public._pe(s.role, 'jere_ekip')) into r
    from public.ekip_dokiman d left join public.staf m on m.id = d.modifye_pa left join public.staf k on k.id = d.kreye_pa where d.id = p_id;
  if r is null then raise exception 'Dokiman sa a pa egziste ankò.'; end if;
  return r;
end $$;

create or replace function public.staf_dokiman_mete(p_code text, p jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); d public.ekip_dokiman; v_id uuid := public._uuid(p->>'id'); v_tit text;
begin
  if v_id is not null then
    select * into d from public.ekip_dokiman where id = v_id for update;
    if d.id is null then raise exception 'Dokiman sa a pa egziste ankò.'; end if;
  end if;
  if coalesce((p->>'efase')::boolean, false) then
    if d.id is null then raise exception 'Dokiman sa a pa egziste ankò.'; end if;
    if d.kreye_pa is distinct from s.id and not public._pe(s.role, 'jere_ekip') then raise exception 'Se moun ki kreye dokiman an ki ka efase l.'; end if;
    delete from public.ekip_dokiman where id = d.id;
    return jsonb_build_object('ok', true);
  end if;
  v_tit := btrim(coalesce(p->>'tit', d.tit, ''));
  if length(v_tit) < 1 or length(v_tit) > 160 then raise exception 'Bay dokiman an yon tit.'; end if;
  if length(coalesce(p->>'kontni', '')) > 200000 then raise exception 'Dokiman an twò long.'; end if;
  if d.id is null then
    insert into public.ekip_dokiman (tit, kontni, kreye_pa, modifye_pa) values (v_tit, coalesce(p->>'kontni', ''), s.id, s.id) returning * into d;
  else
    update public.ekip_dokiman set tit = v_tit, kontni = coalesce(p->>'kontni', kontni), modifye_pa = s.id, modifye_le = now() where id = d.id returning * into d;
  end if;
  return jsonb_build_object('ok', true, 'id', d.id);
end $$;

create or replace function public.staf_konesans(p_code text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'tit', b.tit, 'kontni', b.kontni, 'pou', b.pou, 'modifye_le', b.modifye_le, 'pa', st.non) order by b.tit)
    from public.baz_konesans b left join public.staf st on st.id = b.modifye_pa), '[]');
end $$;

create or replace function public.staf_konesans_mete(p_code text, p jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'konesans'); b public.baz_konesans; v_id uuid := public._uuid(p->>'id'); v_tit text;
  v_pou text := coalesce(nullif(p->>'pou', ''), 'tou_de');
begin
  if v_id is not null then
    select * into b from public.baz_konesans where id = v_id for update;
    if b.id is null then raise exception 'Fich sa a pa egziste ankò.'; end if;
  end if;
  if coalesce((p->>'efase')::boolean, false) then
    delete from public.baz_konesans where id = b.id;
    return jsonb_build_object('ok', true);
  end if;
  v_tit := btrim(coalesce(p->>'tit', b.tit, ''));
  if length(v_tit) < 2 or length(v_tit) > 120 then raise exception 'Bay fich la yon tit.'; end if;
  if length(btrim(coalesce(p->>'kontni', b.kontni, ''))) < 2 then raise exception 'Ekri sa asistan yo dwe konnen.'; end if;
  if length(coalesce(p->>'kontni', '')) > 8000 then raise exception 'Fich la twò long (8000 karaktè maksimòm).'; end if;
  if v_pou not in ('wa', 'ekip', 'tou_de') then raise exception 'Chwazi ki asistan k ap itilize l.'; end if;
  if b.id is null then
    insert into public.baz_konesans (tit, kontni, pou, modifye_pa) values (v_tit, btrim(p->>'kontni'), v_pou, s.id) returning * into b;
  else
    update public.baz_konesans set tit = v_tit, kontni = coalesce(btrim(p->>'kontni'), kontni), pou = v_pou, modifye_pa = s.id, modifye_le = now()
    where id = b.id returning * into b;
  end if;
  return jsonb_build_object('ok', true, 'id', b.id);
end $$;

-- for the team assistant: recent WhatsApp conversations with their messages, without marking anything as read
create or replace function public.staf_wa_rezime(p_code text, p_jou int default 7) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'whatsapp'); depi timestamptz := now() - make_interval(days => least(greatest(coalesce(p_jou, 7), 1), 60));
begin
  return jsonb_build_object(
    'jou', least(greatest(coalesce(p_jou, 7), 1), 60),
    'konvesasyon', (select count(*) from public.wa_konv where denye >= depi),
    'mesaj_kliyan', (select count(*) from public.wa_mesaj where sans = 'in' and kreye_le >= depi),
    'mesaj_asistan', (select count(*) from public.wa_mesaj where sans = 'bot' and kreye_le >= depi),
    'mesaj_ekip', (select count(*) from public.wa_mesaj where sans = 'staf' and kreye_le >= depi),
    'bezwen_moun', (select count(*) from public.wa_konv where alet),
    'detay', coalesce((select jsonb_agg(jsonb_build_object('non', c.non, 'telefon', c.telefon, 'eta', c.eta, 'bezwen_moun', c.alet, 'rezon', c.rezon,
        'kod', i.code_court, 'statut', i.statut,
        'mesaj', (select jsonb_agg(jsonb_build_object('sans', m.sans, 'teks', left(m.teks, 300), 'le', m.kreye_le) order by m.id)
          from (select * from public.wa_mesaj where telefon = c.telefon and kreye_le >= depi order by id desc limit 25) m)) order by c.denye desc)
      from (select * from public.wa_konv where denye >= depi order by denye desc limit 40) c left join public.inscriptions i on i.id = c.inscription_id), '[]'));
end $$;

-- the WhatsApp assistant also reads the knowledge base
create or replace function public.wa_sv_konfig(p_sekre text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare k public.wa_konfig := public._wa_sekre(p_sekre);
begin
  return jsonb_build_object('aktif', k.aktif, 'gemini_kle', k.gemini_kle, 'gemini_model', k.gemini_model, 'wa_token', k.wa_token,
    'wa_phone_id', k.wa_phone_id, 'app_secret', k.app_secret, 'verify_token', k.verify_token, 'enstriksyon', k.enstriksyon,
    'evenement', public.evenement_public(null), 'gwoup', (select lyen_gwoup from public.evenements where id = (public._evt(null)).id),
    'konesans', coalesce((select jsonb_agg(jsonb_build_object('tit', b.tit, 'kontni', b.kontni, 'pou', b.pou) order by b.tit) from public.baz_konesans b), '[]'));
end $$;

revoke all on function public._anons_pou(public.staf, public.ekip_anons), public._uuid(text) from public, anon, authenticated;
grant execute on function public.staf_zouti(text), public.staf_travay_mete(text, jsonb), public.staf_pwoje_mete(text, jsonb), public.staf_lis_mete(text, jsonb),
  public.staf_anons_mete(text, jsonb), public.staf_anons_vi(text), public.staf_dokiman(text, uuid), public.staf_dokiman_mete(text, jsonb),
  public.staf_konesans(text), public.staf_konesans_mete(text, jsonb), public.staf_wa_rezime(text, int), public.wa_sv_konfig(text) to anon, authenticated;
