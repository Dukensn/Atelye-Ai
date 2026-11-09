-- Team accounts: people sign up with their WhatsApp number or email + a password,
-- the super admin approves them and gives a role, a job title and tasks.
-- Each member has a personal space with their access list and a photo badge (QR -> /badj/<code>).
-- Old staff codes keep working. Sessions are random tokens, stored hashed.

alter table public.staf
  add column if not exists idantifyan text,     -- 509XXXXXXXX or lower-case email
  add column if not exists modpas_hash text,
  add column if not exists statut text default 'actif',
  add column if not exists fonksyon text,
  add column if not exists travay text,
  add column if not exists foto text,           -- small JPEG, base64
  add column if not exists badj text;
update public.staf set statut = 'actif' where statut is null;
update public.staf set badj = upper(encode(extensions.gen_random_bytes(6), 'hex')) where badj is null;
create unique index if not exists staf_idantifyan_uq on public.staf (idantifyan) where idantifyan is not null;
create unique index if not exists staf_badj_uq on public.staf (badj) where badj is not null;
do $$ begin
  alter table public.staf add constraint staf_statut_ck check (statut in ('en_attente','actif','refuse','dezaktive'));
exception when duplicate_object then null; end $$;

create table if not exists public.staf_sesyon (
  token_hash text primary key,
  staf_id uuid not null references public.staf(id) on delete cascade,
  expire timestamptz not null);
alter table public.staf_sesyon enable row level security;
revoke all on public.staf_sesyon from anon, authenticated;

-- WhatsApp number or email, normalised
create or replace function public._idantifyan(p text) returns text language plpgsql immutable set search_path = public as $$
declare v text := lower(btrim(coalesce(p, '')));
begin
  if position('@' in v) > 0 then
    if v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v) > 120 then raise exception 'Imèl la pa bon.'; end if;
    return v;
  end if;
  v := public._tel_cle(v);
  if length(v) < 11 or length(v) > 15 then raise exception 'Nimewo WhatsApp la pa bon.'; end if;
  return v;
end $$;

-- p_code is either a session token (new accounts) or an old staff code
create or replace function public._staf(p_code text, p_roles text[]) returns public.staf language plpgsql stable
set search_path = public, extensions as $$
declare s public.staf;
begin
  select st.* into s from public.staf_sesyon x join public.staf st on st.id = x.staf_id
    where x.token_hash = encode(digest(coalesce(p_code, ''), 'sha256'), 'hex') and x.expire > now() and st.actif and st.statut = 'actif';
  if s.id is null then
    select * into s from public.staf where actif and statut = 'actif' and code_hash is not null
      and code_hash = crypt(coalesce(p_code, ''), code_hash) limit 1;
  end if;
  if s.id is null or not (s.role = any (p_roles)) then raise exception 'Kòd la pa bon oswa ou pa gen aksè.' using errcode = '28000'; end if;
  return s;
end $$;

create or replace function public._akse(p_role text) returns jsonb language sql immutable as $$
  select case p_role
    when 'admin' then '["Valide ak refize peman MonCash/NatCash","Enskri moun sou plas","Lis enskripsyon, ranbousman, CSV","Rapèl WhatsApp","Pri, tikè ak evènman","Valide ak jere ekip la","Eskane tikè nan pòt la"]'::jsonb
    when 'validateur' then '["Valide ak refize peman MonCash/NatCash"]'::jsonb
    when 'vandeur' then '["Enskri moun sou plas (kach)","Jwenn ak revoye tikè sou WhatsApp"]'::jsonb
    when 'scanneur' then '["Eskane tikè yo nan pòt la (menm san entènèt)"]'::jsonb
    else '[]'::jsonb end
$$;

create or replace function public.staf_enskri(p_non text, p_idantifyan text, p_modpas text, p_foto text default null) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_id text := public._idantifyan(p_idantifyan); v_non text := btrim(coalesce(p_non, ''));
begin
  if length(v_non) < 2 or length(v_non) > 80 then raise exception 'Ekri non konplè w.'; end if;
  if length(coalesce(p_modpas, '')) < 8 then raise exception 'Modpas la dwe gen omwen 8 karaktè.'; end if;
  if p_foto is not null and length(p_foto) > 300000 then raise exception 'Foto a twò lou.'; end if;
  if exists (select 1 from public.staf where idantifyan = v_id) then raise exception 'Gen yon kont deja ak nimewo oswa imèl sa a.'; end if;
  insert into public.staf (non, role, statut, idantifyan, modpas_hash, foto, badj, actif)
    values (v_non, null, 'en_attente', v_id, crypt(p_modpas, gen_salt('bf', 10)), p_foto, upper(encode(gen_random_bytes(6), 'hex')), true);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_login(p_idantifyan text, p_modpas text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf; tok text := encode(gen_random_bytes(24), 'hex');
begin
  select * into s from public.staf where idantifyan = public._idantifyan(p_idantifyan) and modpas_hash is not null
    and modpas_hash = crypt(coalesce(p_modpas, ''), modpas_hash);
  if s.id is null then raise exception 'Nimewo/imèl la oswa modpas la pa bon.' using errcode = '28000'; end if;
  if s.statut = 'en_attente' then raise exception 'Kont ou poko valide. Super admin lan ap valide l, epi l ap ba w wòl ou.'; end if;
  if s.statut <> 'actif' or not s.actif then raise exception 'Kont sa a pa aktif.'; end if;
  insert into public.staf_sesyon (token_hash, staf_id, expire) values (encode(digest(tok, 'sha256'), 'hex'), s.id, now() + interval '30 days');
  return jsonb_build_object('token', tok, 'role', s.role, 'non', s.non);
end $$;

create or replace function public.staf_soti(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  update public.staf_sesyon set expire = now() where token_hash = encode(digest(coalesce(p_code, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

-- personal space: role, job, tasks, access list, badge
create or replace function public.staf_mwen(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur','scanneur','vandeur']); e public.evenements := public._evt(null);
begin
  return jsonb_build_object('id', s.id, 'non', s.non, 'role', s.role, 'fonksyon', s.fonksyon, 'travay', s.travay, 'foto', s.foto,
    'badj', s.badj, 'idantifyan', s.idantifyan, 'akse', public._akse(s.role),
    'evenement', case when e.id is null then null else jsonb_build_object('nom', e.nom, 'date', e.date, 'lieu', e.lieu) end);
end $$;

create or replace function public.staf_foto(p_code text, p_foto text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur','scanneur','vandeur']);
begin
  if p_foto is null or length(p_foto) > 300000 then raise exception 'Foto a pa bon oswa twò lou.'; end if;
  update public.staf set foto = p_foto where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

-- lets someone who logged in with an old code set a number/email + password
create or replace function public.staf_mete_kont(p_code text, p_idantifyan text, p_modpas text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur','scanneur','vandeur']); v_id text := public._idantifyan(p_idantifyan);
begin
  if length(coalesce(p_modpas, '')) < 8 then raise exception 'Modpas la dwe gen omwen 8 karaktè.'; end if;
  if exists (select 1 from public.staf where idantifyan = v_id and id <> s.id) then raise exception 'Nimewo oswa imèl sa a deja itilize.'; end if;
  update public.staf set idantifyan = v_id, modpas_hash = crypt(p_modpas, gen_salt('bf', 10)) where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

-- super admin: the whole team, including people waiting for approval
create or replace function public.staf_ekip(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin']);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'non', non, 'role', role, 'statut', statut, 'fonksyon', fonksyon, 'travay', travay,
      'foto', foto, 'badj', badj, 'idantifyan', idantifyan, 'cree_le', cree_le, 'mwen', id = s.id)
    order by (statut = 'en_attente') desc, cree_le desc) from public.staf), '[]'::jsonb);
end $$;

create or replace function public.staf_ekip_mete(p_code text, p_id uuid, p_statut text, p_role text, p_fonksyon text, p_travay text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin']);
begin
  if p_statut not in ('actif','refuse','dezaktive') then raise exception 'Estati a pa bon.'; end if;
  if p_statut = 'actif' and (p_role is null or p_role not in ('admin','validateur','scanneur','vandeur')) then raise exception 'Chwazi yon wòl.'; end if;
  if p_id = s.id and p_statut <> 'actif' then raise exception 'Ou pa ka dezaktive pwòp kont ou.'; end if;
  update public.staf set statut = p_statut, role = coalesce(p_role, role), fonksyon = nullif(btrim(coalesce(p_fonksyon, '')), ''),
    travay = nullif(btrim(coalesce(p_travay, '')), '') where id = p_id;
  if p_statut <> 'actif' then update public.staf_sesyon set expire = now() where staf_id = p_id; end if;
  return jsonb_build_object('ok', true);
end $$;

-- badge check at the door: anyone scanning the QR sees who it is and whether the badge is valid
create or replace function public.badj_public(p_badj text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.staf; e public.evenements := public._evt(null);
begin
  select * into s from public.staf where badj = upper(btrim(coalesce(p_badj, '')));
  if s.id is null then return null; end if;
  return jsonb_build_object('non', s.non, 'role', s.role, 'fonksyon', s.fonksyon, 'foto', s.foto, 'badj', s.badj,
    'valid', s.actif and s.statut = 'actif',
    'evenement', case when e.id is null then null else jsonb_build_object('nom', e.nom, 'date', e.date, 'lieu', e.lieu) end);
end $$;

revoke execute on function public._idantifyan(text), public._akse(text) from public, anon, authenticated;
grant execute on function public.staf_enskri(text, text, text, text), public.staf_login(text, text), public.staf_soti(text),
  public.staf_mwen(text), public.staf_foto(text, text), public.staf_mete_kont(text, text, text),
  public.staf_ekip(text), public.staf_ekip_mete(text, uuid, text, text, text, text), public.badj_public(text)
  to anon, authenticated;
