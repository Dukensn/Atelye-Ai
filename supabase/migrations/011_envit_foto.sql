-- Team invitation links (one use, 24 h; the account is active at once with the role chosen by the admin),
-- and photo uploads by the team: a member's profile photo, a payment proof on someone's registration.

create table if not exists public.staf_envit (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  role text not null,
  fonksyon text,
  kreye_pa uuid references public.staf(id) on delete set null,
  kreye_le timestamptz not null default now(),
  expire timestamptz not null,
  itilize_le timestamptz,
  itilize_pa uuid references public.staf(id) on delete set null,
  anile boolean not null default false);
create index if not exists staf_envit_kreye_pa on public.staf_envit (kreye_pa);
create index if not exists staf_envit_itilize_pa on public.staf_envit (itilize_pa);
alter table public.staf_envit enable row level security;
revoke all on public.staf_envit from anon, authenticated;

create or replace function public.staf_envit_kreye(p_code text, p_role text, p_fonksyon text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip'); tok text := encode(gen_random_bytes(18), 'hex'); e public.staf_envit;
begin
  if not exists (select 1 from public.wol where kle = p_role) then raise exception 'Chwazi yon wòl.'; end if;
  if p_role = 'admin' and s.role <> 'admin' then raise exception 'Se yon super admin sèlman ki ka envite yon super admin.'; end if;
  if length(coalesce(p_fonksyon, '')) > 60 then raise exception 'Tit la twò long.'; end if;
  insert into public.staf_envit (token_hash, role, fonksyon, kreye_pa, expire)
    values (encode(digest(tok, 'sha256'), 'hex'), p_role, nullif(btrim(coalesce(p_fonksyon, '')), ''), s.id, now() + interval '24 hours') returning * into e;
  return jsonb_build_object('ok', true, 'id', e.id, 'token', tok, 'expire', e.expire);
end $$;

create or replace function public.staf_envit_lis(p_code text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip');
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'role', e.role, 'role_non', w.non, 'fonksyon', e.fonksyon, 'expire', e.expire, 'kreye_le', e.kreye_le,
      'itilize_le', e.itilize_le, 'itilize_pa', u.non, 'pa', k.non) order by e.kreye_le desc)
    from public.staf_envit e left join public.wol w on w.kle = e.role left join public.staf u on u.id = e.itilize_pa left join public.staf k on k.id = e.kreye_pa
    where not e.anile and ((e.itilize_le is null and e.expire > now()) or e.itilize_le > now() - interval '7 days')), '[]');
end $$;

create or replace function public.staf_envit_anile(p_code text, p_id uuid) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip');
begin
  update public.staf_envit set anile = true where id = p_id and itilize_le is null;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public._envit(p_token text) returns public.staf_envit language sql stable set search_path = public, extensions as $$
  select * from public.staf_envit where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

-- what the invitation page shows before the person signs up
create or replace function public.staf_envit_tcheke(p_token text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare e public.staf_envit := public._envit(p_token); w public.wol;
begin
  if e.id is null or e.anile then return jsonb_build_object('ok', false, 'rezon', 'Lyen sa a pa valid.'); end if;
  if e.itilize_le is not null then return jsonb_build_object('ok', false, 'rezon', 'Lyen sa a deja itilize.'); end if;
  if e.expire <= now() then return jsonb_build_object('ok', false, 'rezon', 'Lyen sa a ekspire (24 è).'); end if;
  select * into w from public.wol where kle = e.role;
  return jsonb_build_object('ok', true, 'role_non', w.non, 'fonksyon', e.fonksyon, 'expire', e.expire);
end $$;

-- sign up through an invitation: active at once, logged in
create or replace function public.staf_enskri_envit(p_token text, p_non text, p_idantifyan text, p_modpas text, p_foto text default null) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare e public.staf_envit; v_id text; v_non text := btrim(coalesce(p_non, '')); s public.staf; tok text := encode(gen_random_bytes(24), 'hex');
begin
  select * into e from public.staf_envit where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if e.id is null or e.anile then raise exception 'Lyen sa a pa valid.'; end if;
  if e.itilize_le is not null then raise exception 'Lyen sa a deja itilize. Mande admin lan yon nouvo lyen.'; end if;
  if e.expire <= now() then raise exception 'Lyen sa a ekspire (24 è). Mande admin lan yon nouvo lyen.'; end if;
  if not exists (select 1 from public.wol where kle = e.role) then raise exception 'Wòl envitasyon an pa egziste ankò.'; end if;
  v_id := public._idantifyan(p_idantifyan);
  if length(v_non) < 2 or length(v_non) > 80 then raise exception 'Ekri non konplè w.'; end if;
  if length(coalesce(p_modpas, '')) < 8 then raise exception 'Modpas la dwe gen omwen 8 karaktè.'; end if;
  if p_foto is not null and length(p_foto) > 300000 then raise exception 'Foto a twò lou.'; end if;
  if exists (select 1 from public.staf where idantifyan = v_id or tel = v_id or imel = v_id) then raise exception 'Gen yon kont deja ak nimewo oswa imèl sa a.'; end if;
  insert into public.staf (non, role, statut, idantifyan, tel, imel, modpas_hash, foto, badj, actif, fonksyon)
    values (v_non, e.role, 'actif', v_id, case when v_id like '%@%' then null else v_id end, case when v_id like '%@%' then v_id end,
            crypt(p_modpas, gen_salt('bf', 10)), nullif(p_foto, ''), upper(encode(gen_random_bytes(6), 'hex')), true, e.fonksyon)
    returning * into s;
  update public.staf_envit set itilize_le = now(), itilize_pa = s.id where id = e.id;
  insert into public.staf_sesyon (token_hash, staf_id, expire) values (encode(digest(tok, 'sha256'), 'hex'), s.id, now() + interval '30 days');
  return jsonb_build_object('ok', true, 'token', tok, 'non', s.non, 'role', s.role);
end $$;

-- a team manager sets a member's photo
create or replace function public.staf_ekip_foto(p_code text, p_id uuid, p_foto text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'jere_ekip');
begin
  if p_foto is null or length(p_foto) < 100 or length(p_foto) > 300000 then raise exception 'Foto a pa bon oswa twò lou.'; end if;
  update public.staf set foto = p_foto where id = p_id;
  if not found then raise exception 'Manm sa a pa egziste.'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- the team adds the payment proof someone sent another way (WhatsApp, in person): it joins the payment queue
create or replace function public.staf_kapti_mete(p_code text, p_id uuid, p_capture text, p_type text default 'image/jpeg') returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'valide_peman'); r public.inscriptions;
begin
  select * into r from public.inscriptions where id = p_id for update;
  if r.id is null then raise exception 'Enskripsyon sa a pa egziste.'; end if;
  if r.statut <> 'en_attente' then raise exception 'Enskripsyon sa a deja trete.'; end if;
  if p_capture is null or length(p_capture) < 100 or length(p_capture) > 1400000 then raise exception 'Foto a pa bon oswa twò lou.'; end if;
  if coalesce(p_type, '') not in ('image/jpeg', 'image/png', 'image/webp') then raise exception 'Foto a dwe JPG, PNG oswa WEBP.'; end if;
  insert into public.captures (inscription_id, image, type) values (r.id, decode(p_capture, 'base64'), p_type)
    on conflict (inscription_id) do update set image = excluded.image, type = excluded.type, cree_le = now();
  update public.inscriptions set reference_paiement = coalesce(reference_paiement, 'FOTO-' || code_court), soumis_le = coalesce(soumis_le, now()) where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public._envit(text) from public, anon, authenticated;
grant execute on function public.staf_envit_kreye(text, text, text), public.staf_envit_lis(text), public.staf_envit_anile(text, uuid),
  public.staf_envit_tcheke(text), public.staf_enskri_envit(text, text, text, text, text), public.staf_ekip_foto(text, uuid, text),
  public.staf_kapti_mete(text, uuid, text, text) to anon, authenticated;
