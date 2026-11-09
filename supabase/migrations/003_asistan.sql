-- Helpers who assist the team ("asistan"): a badge and a personal space, no access to tickets or payments.
-- Team badges are permanent: they show "member since" instead of the event date.
alter table public.staf drop constraint if exists staf_role_ck;
alter table public.staf add constraint staf_role_ck check (role in ('admin','validateur','scanneur','vandeur','asistan'));


create or replace function public.staf_konekte(p_code text) returns jsonb language plpgsql stable
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur','scanneur','vandeur','asistan']);
begin
  return jsonb_build_object('non', s.non, 'role', s.role, 'evenement', public.evenement_public(null));
end $$;

create or replace function public.staf_kreye(p_code text, p_non text, p_role text, p_nouvo_code text) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin']);
begin
  if p_role not in ('admin','validateur','scanneur','vandeur','asistan') then raise exception 'Wòl la pa bon.'; end if;
  if length(coalesce(p_nouvo_code, '')) < 10 then raise exception 'Kòd la dwe gen omwen 10 karaktè.'; end if;
  insert into public.staf (non, role, code_hash) values (btrim(p_non), p_role, crypt(p_nouvo_code, gen_salt('bf', 10)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_mwen(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur','scanneur','vandeur','asistan']); e public.evenements := public._evt(null);
begin
  return jsonb_build_object('id', s.id, 'non', s.non, 'role', s.role, 'fonksyon', s.fonksyon, 'travay', s.travay, 'foto', s.foto,
    'badj', s.badj, 'idantifyan', s.idantifyan, 'depi', s.cree_le, 'akse', public._akse(s.role),
    'evenement', case when e.id is null then null else jsonb_build_object('nom', e.nom, 'date', e.date, 'lieu', e.lieu) end);
end $$;

create or replace function public.staf_foto(p_code text, p_foto text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur','scanneur','vandeur','asistan']);
begin
  if p_foto is null or length(p_foto) > 300000 then raise exception 'Foto a pa bon oswa twò lou.'; end if;
  update public.staf set foto = p_foto where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_mete_kont(p_code text, p_idantifyan text, p_modpas text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin','validateur','scanneur','vandeur','asistan']); v_id text := public._idantifyan(p_idantifyan);
begin
  if length(coalesce(p_modpas, '')) < 8 then raise exception 'Modpas la dwe gen omwen 8 karaktè.'; end if;
  if exists (select 1 from public.staf where idantifyan = v_id and id <> s.id) then raise exception 'Nimewo oswa imèl sa a deja itilize.'; end if;
  update public.staf set idantifyan = v_id, modpas_hash = crypt(p_modpas, gen_salt('bf', 10)) where id = s.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.staf_ekip_mete(p_code text, p_id uuid, p_statut text, p_role text, p_fonksyon text, p_travay text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare s public.staf := public._staf(p_code, array['admin']);
begin
  if p_statut not in ('actif','refuse','dezaktive') then raise exception 'Estati a pa bon.'; end if;
  if p_statut = 'actif' and (p_role is null or p_role not in ('admin','validateur','scanneur','vandeur','asistan')) then raise exception 'Chwazi yon wòl.'; end if;
  if p_id = s.id and p_statut <> 'actif' then raise exception 'Ou pa ka dezaktive pwòp kont ou.'; end if;
  update public.staf set statut = p_statut, role = coalesce(p_role, role), fonksyon = nullif(btrim(coalesce(p_fonksyon, '')), ''),
    travay = nullif(btrim(coalesce(p_travay, '')), '') where id = p_id;
  if p_statut <> 'actif' then update public.staf_sesyon set expire = now() where staf_id = p_id; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.badj_public(p_badj text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.staf; e public.evenements := public._evt(null);
begin
  select * into s from public.staf where badj = upper(btrim(coalesce(p_badj, '')));
  if s.id is null then return null; end if;
  return jsonb_build_object('non', s.non, 'role', s.role, 'fonksyon', s.fonksyon, 'foto', s.foto, 'badj', s.badj, 'depi', s.cree_le,
    'valid', s.actif and s.statut = 'actif',
    'evenement', case when e.id is null then null else jsonb_build_object('nom', e.nom, 'date', e.date, 'lieu', e.lieu) end);
end $$;

create or replace function public._akse(p_role text) returns jsonb language sql immutable as $$
  select case p_role
    when 'admin' then '["Valide ak refize peman MonCash/NatCash","Enskri moun sou plas","Lis enskripsyon, ranbousman, CSV","Rapèl WhatsApp","Pri, tikè ak evènman","Valide ak jere ekip la","Eskane tikè nan pòt la"]'::jsonb
    when 'validateur' then '["Valide ak refize peman MonCash/NatCash"]'::jsonb
    when 'vandeur' then '["Enskri moun sou plas (kach)","Jwenn ak revoye tikè sou WhatsApp"]'::jsonb
    when 'scanneur' then '["Eskane tikè yo nan pòt la (menm san entènèt)"]'::jsonb
    when 'asistan' then '["Ede ekip la jou atelye a","Akeyi ak oryante moun yo"]'::jsonb
    else '[]'::jsonb end
$$;
