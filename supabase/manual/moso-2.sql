-- Atelye AI · moso 2/4 · kole tout, epi Run
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
select 'Moso 2/4 OK ✓' as rezilta;
