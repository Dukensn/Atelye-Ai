-- Atelye AI · moso 4/4 · kole tout, epi Run
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
grant execute on function public.staf_travay_mete(text, jsonb), public.staf_pwoje_mete(text, jsonb), public.staf_lis_mete(text, jsonb),
  public.staf_anons_mete(text, jsonb), public.staf_anons_vi(text), public.staf_dokiman(text, uuid), public.staf_dokiman_mete(text, jsonb),
  public.staf_konesans(text), public.staf_konesans_mete(text, jsonb), public.staf_wa_rezime(text, int), public.wa_sv_konfig(text) to anon, authenticated;
select 'Moso 4/4 OK ✓' as rezilta;
