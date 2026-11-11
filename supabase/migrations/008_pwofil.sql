-- Team accounts: a phone AND an email, either one logs in; each member edits their own profile (name, photo, phone, email, password).
alter table public.staf add column if not exists tel text, add column if not exists imel text;
update public.staf set imel = idantifyan where imel is null and idantifyan like '%@%';
update public.staf set tel = idantifyan where tel is null and idantifyan is not null and idantifyan not like '%@%';
create unique index if not exists staf_tel_uk on public.staf (tel) where tel is not null;
create unique index if not exists staf_imel_uk on public.staf (imel) where imel is not null;

-- '' -> null, else the normalised phone or email (raises on a bad one)
create or replace function public._id_oswa_nil(p text) returns text language sql immutable set search_path = public as $$
  select case when btrim(coalesce(p, '')) = '' then null else public._idantifyan(p) end
$$;

create or replace function public.staf_login(p_idantifyan text, p_modpas text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf; v text := public._idantifyan(p_idantifyan); tok text := encode(gen_random_bytes(24), 'hex');
begin
  select * into s from public.staf where (tel = v or imel = v or idantifyan = v) and modpas_hash is not null
    and modpas_hash = crypt(coalesce(p_modpas, ''), modpas_hash) limit 1;
  if s.id is null then raise exception 'Nimewo/imèl la oswa modpas la pa bon.' using errcode = '28000'; end if;
  if s.statut = 'en_attente' then raise exception 'Kont ou poko valide. Super admin lan ap valide l, epi l ap ba w wòl ou.'; end if;
  if s.statut <> 'actif' or not s.actif then raise exception 'Kont sa a pa aktif.'; end if;
  insert into public.staf_sesyon (token_hash, staf_id, expire) values (encode(digest(tok, 'sha256'), 'hex'), s.id, now() + interval '30 days');
  return jsonb_build_object('token', tok, 'role', s.role, 'non', s.non);
end $$;

-- sign-up: the photo is optional now (it can be added later from the profile)
create or replace function public.staf_enskri(p_non text, p_idantifyan text, p_modpas text, p_foto text default null) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_id text := public._idantifyan(p_idantifyan); v_non text := btrim(coalesce(p_non, ''));
begin
  if length(v_non) < 2 or length(v_non) > 80 then raise exception 'Ekri non konplè w.'; end if;
  if length(coalesce(p_modpas, '')) < 8 then raise exception 'Modpas la dwe gen omwen 8 karaktè.'; end if;
  if p_foto is not null and length(p_foto) > 300000 then raise exception 'Foto a twò lou.'; end if;
  if exists (select 1 from public.staf where idantifyan = v_id or tel = v_id or imel = v_id) then raise exception 'Gen yon kont deja ak nimewo oswa imèl sa a.'; end if;
  insert into public.staf (non, role, statut, idantifyan, tel, imel, modpas_hash, foto, badj, actif)
    values (v_non, null, 'en_attente', v_id, case when v_id like '%@%' then null else v_id end, case when v_id like '%@%' then v_id end,
            crypt(p_modpas, gen_salt('bf', 10)), nullif(p_foto, ''), upper(encode(gen_random_bytes(6), 'hex')), true);
  return jsonb_build_object('ok', true);
end $$;

-- a member edits their own profile. Changing the password needs the current one (when there is one).
create or replace function public.staf_pwofil(p_code text, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null);
  v_non text := btrim(coalesce(p->>'non', s.non)); v_tel text; v_imel text; nouvo text := coalesce(p->>'modpas', '');
begin
  if length(v_non) < 2 or length(v_non) > 80 then raise exception 'Ekri non konplè w.'; end if;
  v_tel := case when p ? 'tel' then public._id_oswa_nil(p->>'tel') else s.tel end;
  v_imel := case when p ? 'imel' then public._id_oswa_nil(p->>'imel') else s.imel end;
  if v_tel like '%@%' then raise exception 'Mete yon nimewo telefòn nan kaz telefòn nan.'; end if;
  if v_imel is not null and v_imel not like '%@%' then raise exception 'Mete yon imèl nan kaz imèl la.'; end if;
  if v_tel is not null and exists (select 1 from public.staf where id <> s.id and (tel = v_tel or idantifyan = v_tel)) then raise exception 'Nimewo sa a deja itilize.'; end if;
  if v_imel is not null and exists (select 1 from public.staf where id <> s.id and (imel = v_imel or idantifyan = v_imel)) then raise exception 'Imèl sa a deja itilize.'; end if;
  if nouvo <> '' then
    if length(nouvo) < 8 then raise exception 'Nouvo modpas la dwe gen omwen 8 karaktè.'; end if;
    if s.modpas_hash is not null and s.modpas_hash <> crypt(coalesce(p->>'modpas_ansyen', ''), s.modpas_hash) then raise exception 'Modpas aktyèl la pa bon.'; end if;
  end if;
  if nouvo = '' and s.modpas_hash is null and (v_tel is not null or v_imel is not null) then raise exception 'Chwazi yon modpas pou w ka konekte.'; end if;
  update public.staf set non = v_non, tel = v_tel, imel = v_imel, idantifyan = coalesce(v_imel, v_tel),
    modpas_hash = case when nouvo <> '' then crypt(nouvo, gen_salt('bf', 10)) else modpas_hash end where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_mwen(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); w public.wol; e public.evenements := public._evt(null);
begin
  select * into w from public.wol where kle = s.role;
  return jsonb_build_object('id', s.id, 'non', s.non, 'role', s.role, 'role_non', w.non, 'role_desk', w.deskripsyon, 'koule', w.koule,
    'fonksyon', s.fonksyon, 'travay', s.travay, 'foto', s.foto, 'badj', s.badj, 'idantifyan', s.idantifyan, 'tel', s.tel, 'imel', s.imel,
    'gen_modpas', s.modpas_hash is not null, 'depi', s.cree_le,
    'akse', public._akse(s.role), 'akse_kle', to_jsonb(case when w.sistem then public._akse_tout() else w.akse end),
    'evenement', case when e.id is null then null else jsonb_build_object('nom', e.nom, 'date', e.date, 'lieu', e.lieu) end);
end $$;

create or replace function public.staf_ekip(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'non', st.non, 'role', st.role, 'role_non', w.non, 'koule', w.koule, 'statut', st.statut,
      'fonksyon', st.fonksyon, 'travay', st.travay, 'foto', st.foto, 'badj', st.badj,
      'idantifyan', nullif(concat_ws(' · ', st.tel, st.imel), ''), 'cree_le', st.cree_le, 'mwen', st.id = s.id)
    order by (st.statut = 'en_attente') desc, st.cree_le desc) from public.staf st left join public.wol w on w.kle = st.role), '[]'::jsonb);
end $$;

revoke all on function public._id_oswa_nil(text) from public, anon, authenticated;
grant execute on function public.staf_pwofil(text, jsonb), public.staf_login(text, text), public.staf_enskri(text, text, text, text),
  public.staf_mwen(text), public.staf_ekip(text) to anon, authenticated;
