-- Atelye AI · moso 3/4 · kole tout, epi Run
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
select 'Moso 3/4 OK ✓' as rezilta;
