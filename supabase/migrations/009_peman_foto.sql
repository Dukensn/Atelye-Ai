-- Manual payment: the buyer sends a screenshot of the MonCash/NatCash payment, nothing else.
-- With no transaction number, the reference becomes "FOTO-<code>" (unique per sign-up) so every queue and count keeps working.
create or replace function public.soumettre_paiement(p_id uuid, p_jeton text, p_reference text, p_capture text default null,
  p_capture_type text default 'image/jpeg') returns jsonb language plpgsql volatile
security definer set search_path = public as $$
declare r public.inscriptions; ref text := upper(btrim(coalesce(p_reference, ''))); img bytea;
begin
  select * into r from public.inscriptions where id = p_id and jeton = p_jeton for update;
  if r.id is null then raise exception 'Enskripsyon sa a pa egziste.'; end if;
  if r.statut <> 'en_attente' then raise exception 'Enskripsyon sa a deja trete.'; end if;
  if ref = '' then
    if p_capture is null or length(p_capture) = 0 then raise exception 'Mete foto prèv peman an (kapti ekran an).'; end if;
    ref := 'FOTO-' || r.code_court;
  else
    if length(ref) < 4 or length(ref) > 40 then raise exception 'Nimewo tranzaksyon an pa bon.'; end if;
    if exists (select 1 from public.inscriptions where evenement_id = r.evenement_id and statut = 'valide' and lower(reference_paiement) = lower(ref))
      then raise exception 'Nimewo tranzaksyon sa a deja itilize.'; end if;
  end if;
  update public.inscriptions set reference_paiement = ref, soumis_le = now() where id = r.id;
  if p_capture is not null and length(p_capture) > 0 then
    if length(p_capture) > 1400000 then raise exception 'Foto a twò lou.'; end if;
    if p_capture_type not in ('image/jpeg', 'image/png', 'image/webp') then raise exception 'Foto a dwe JPG, PNG oswa WEBP.'; end if;
    img := decode(p_capture, 'base64');
    insert into public.captures (inscription_id, image, type) values (r.id, img, p_capture_type)
      on conflict (inscription_id) do update set image = excluded.image, type = excluded.type, cree_le = now();
  end if;
  return jsonb_build_object('ok', true, 'code_court', r.code_court);
end $$;
-- the assistant uses the newer flash model by default
alter table public.wa_konfig alter column gemini_model set default 'gemini-3.8-flash';
update public.wa_konfig set gemini_model = 'gemini-3.8-flash' where gemini_model = 'gemini-2.5-flash';
