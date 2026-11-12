-- Atelye AI · moso 1/4 · kole tout, epi Run
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
select 'Moso 1/4 OK ✓' as rezilta;
