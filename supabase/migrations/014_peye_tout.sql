-- Registration: the person may pay the registration fee only, or everything at once (p_tout).
-- Launch offer: the first N registrations pay only P % of the training price (registration fee unchanged).
alter table public.types_billets add column if not exists premye_n int, add column if not exists premye_pousan int;
drop function if exists public.inscrire(uuid, text, text, text, jsonb, text);
create or replace function public.inscrire(p_type uuid, p_nom text, p_telephone text, p_email text default null,
  p_reponses jsonb default '{}'::jsonb, p_moyen text default 'moncash', p_tout boolean default false) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare t public.types_billets; e public.evenements; v_nom text := btrim(coalesce(p_nom, '')); cle text := public._tel_cle(p_telephone);
  em text := nullif(btrim(coalesce(p_email, '')), ''); deja public.inscriptions; v_code text; j text := encode(gen_random_bytes(18), 'hex'); r public.inscriptions;
  v_avans numeric; v_total numeric; v_fom numeric; v_avan int;
begin
  select * into t from public.types_billets where id = p_type;
  select * into e from public.evenements where id = t.evenement_id;
  if t.id is null or e.statut <> 'ouvert' or t.prix_htg is null or (t.date_fin_vente is not null and t.date_fin_vente <= now())
    then raise exception 'Tikè sa a pa disponib ankò.'; end if;
  if public._restants_type(t.id) <= 0 then raise exception 'Pa gen plas ankò pou tikè sa a.'; end if;
  if public._bloke(t.id) then raise exception 'Tikè sa a poko disponib: pran tikè Lève-bonè a pandan l la.'; end if;
  if length(v_nom) < 2 or length(v_nom) > 80 then raise exception 'Ekri non w.'; end if;
  if length(cle) < 11 or length(cle) > 15 then raise exception 'Nimewo WhatsApp la pa bon.'; end if;
  if em is not null and (length(em) > 120 or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'Imèl la pa bon.'; end if;
  if p_moyen not in ('moncash', 'natcash') then raise exception 'Chwazi MonCash oswa NatCash.'; end if;
  if pg_column_size(p_reponses) > 4000 then raise exception 'Repons yo twò long.'; end if;
  -- a deposit only counts when it is below the full price

  select * into deja from public.inscriptions where evenement_id = e.id and telephone_cle = cle for update;
  -- the same number may start again while no payment proof was sent yet (it keeps its code)
  if deja.id is not null and deja.statut <> 'refuse' and not (deja.statut = 'en_attente' and deja.reference_paiement is null) then
    raise exception 'Nimewo sa a enskri deja. Chèche tikè w nan « Jwenn tikè mwen ».';
  end if;
  -- training price (full price minus the registration fee), reduced for the first N people who register
  -- rank: people registered before this one (a person who starts again keeps their place)
  select count(*) into v_avan from public.inscriptions where evenement_id = e.id and statut <> 'refuse' and telephone_cle <> cle
    and (deja.id is null or deja.statut = 'refuse' or cree_le < deja.cree_le);
  v_fom := t.prix_htg - case when t.avans_htg > 0 and t.avans_htg < t.prix_htg then t.avans_htg else 0 end;
  if t.premye_n is not null and t.premye_pousan is not null and v_avan < t.premye_n then v_fom := round(v_fom * t.premye_pousan / 100.0); end if;
  if t.avans_htg is not null and t.avans_htg > 0 and t.avans_htg < t.prix_htg then
    if coalesce(p_tout, false) then v_avans := t.avans_htg + v_fom; v_total := null;
    else v_avans := t.avans_htg; v_total := t.avans_htg + v_fom; end if;
  else v_avans := v_fom; v_total := null; end if;
  if deja.id is not null then
    update public.inscriptions set type_billet_id = t.id, nom = v_nom, telephone = btrim(p_telephone), email = em, reponses = coalesce(p_reponses, '{}'),
      moyen_paiement = p_moyen, reference_paiement = null, montant = v_avans, total_htg = v_total, rete_peye_le = null, rete_peye_pa = null, rete_moyen = null,
      statut = 'en_attente', motif_refus = null, jeton = j, soumis_le = null, cree_le = case when deja.statut = 'refuse' then now() else cree_le end
      where id = deja.id returning * into r;
    update public.captures set image = null where inscription_id = r.id;
  else
    loop
      v_code := 'AT-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
      exit when not exists (select 1 from public.inscriptions where evenement_id = e.id and code_court = v_code);
    end loop;
    insert into public.inscriptions (evenement_id, type_billet_id, code_court, jeton, nom, telephone, telephone_cle, email, reponses, moyen_paiement, montant, total_htg, devise)
      values (e.id, t.id, v_code, j, v_nom, btrim(p_telephone), cle, em, coalesce(p_reponses, '{}'), p_moyen, v_avans, v_total, 'HTG') returning * into r;
  end if;
  return jsonb_build_object('id', r.id, 'jeton', r.jeton, 'code_court', r.code_court, 'montant', r.montant, 'prix_usd', t.prix_usd,
    'moyen', r.moyen_paiement, 'type', t.nom, 'total', coalesce(r.total_htg, r.montant), 'rete', public._rete(r.montant, r.total_htg, r.rete_peye_le),
    'pwomo', t.premye_n is not null and v_avan < t.premye_n);
end $$;
revoke all on function public.inscrire(uuid, text, text, text, jsonb, text, boolean) from public;
grant execute on function public.inscrire(uuid, text, text, text, jsonb, text, boolean) to anon, authenticated;

create or replace function public.evenement_public(p_evenement uuid default null) returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare e public.evenements := public._evt(p_evenement); pris int; enskri int;
begin
  if e.id is null then return null; end if;
  select count(*) into pris from public.billets b join public.inscriptions i on i.id = b.inscription_id
    where i.evenement_id = e.id and b.statut <> 'annule';
  select count(*) into enskri from public.inscriptions where evenement_id = e.id and statut <> 'refuse';
  return jsonb_build_object('id', e.id, 'nom', e.nom, 'date', e.date, 'lieu', e.lieu, 'adresse', e.adresse,
    'capacite', e.capacite, 'restants', greatest(coalesce(e.capacite, 0) - pris, 0), 'statut', e.statut,
    'types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nom', t.nom, 'prix_usd', t.prix_usd, 'prix_htg', t.prix_htg,
        'avans_htg', case when t.avans_htg < t.prix_htg then t.avans_htg end,
        'premye_n', t.premye_n, 'premye_pousan', t.premye_pousan, 'premye_rete', case when t.premye_n is not null then greatest(t.premye_n - enskri, 0) end,
        'date_fin_vente', t.date_fin_vente, 'quota', t.quota, 'avantaj', coalesce(t.avantaj, '[]'::jsonb),
        'restants', greatest(public._restants_type(t.id), 0), 'bloke', public._bloke(t.id), 'ouvre_le', public._ouvre_le(t.id)) order by t.ordre, t.prix_htg)
      from public.types_billets t where t.evenement_id = e.id and t.prix_htg is not null
        and (t.date_fin_vente is null or t.date_fin_vente > now())), '[]'::jsonb));
end $$;

-- this event: registrations close before 2 December (Haiti time); the first 5 pay 60 % of the training
update public.types_billets set date_fin_vente = '2026-12-02 00:00:00-05', premye_n = 5, premye_pousan = 60
  where prix_htg = 6500 and avans_htg = 1000;
