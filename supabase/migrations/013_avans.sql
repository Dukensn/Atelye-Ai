-- Deposit (avans): a ticket type can be reserved with a non-refundable deposit; the rest is paid later or at the door.
alter table public.types_billets add column if not exists avans_htg numeric(12,2);
alter table public.inscriptions
  add column if not exists total_htg numeric(12,2),        -- full price when only a deposit was asked (null = paid in full)
  add column if not exists rete_peye_le timestamptz,       -- when the rest was paid
  add column if not exists rete_peye_pa text,
  add column if not exists rete_moyen text;

-- amount still due on a registration (0 when paid in full or the rest is settled)
create or replace function public._rete(p_montant numeric, p_total numeric, p_peye timestamptz) returns numeric language sql immutable as $$
  select case when p_total is null or p_peye is not null then 0 else greatest(p_total - coalesce(p_montant, 0), 0) end
$$;

create or replace function public.evenement_public(p_evenement uuid default null) returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare e public.evenements := public._evt(p_evenement); pris int;
begin
  if e.id is null then return null; end if;
  select count(*) into pris from public.billets b join public.inscriptions i on i.id = b.inscription_id
    where i.evenement_id = e.id and b.statut <> 'annule';
  return jsonb_build_object('id', e.id, 'nom', e.nom, 'date', e.date, 'lieu', e.lieu, 'adresse', e.adresse,
    'capacite', e.capacite, 'restants', greatest(coalesce(e.capacite, 0) - pris, 0), 'statut', e.statut,
    'types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nom', t.nom, 'prix_usd', t.prix_usd, 'prix_htg', t.prix_htg,
        'avans_htg', case when t.avans_htg < t.prix_htg then t.avans_htg end,
        'date_fin_vente', t.date_fin_vente, 'quota', t.quota, 'avantaj', coalesce(t.avantaj, '[]'::jsonb),
        'restants', greatest(public._restants_type(t.id), 0), 'bloke', public._bloke(t.id), 'ouvre_le', public._ouvre_le(t.id)) order by t.ordre, t.prix_htg)
      from public.types_billets t where t.evenement_id = e.id and t.prix_htg is not null
        and (t.date_fin_vente is null or t.date_fin_vente > now())), '[]'::jsonb));
end $$;

create or replace function public.inscrire(p_type uuid, p_nom text, p_telephone text, p_email text default null,
  p_reponses jsonb default '{}'::jsonb, p_moyen text default 'moncash') returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare t public.types_billets; e public.evenements; v_nom text := btrim(coalesce(p_nom, '')); cle text := public._tel_cle(p_telephone);
  em text := nullif(btrim(coalesce(p_email, '')), ''); deja public.inscriptions; v_code text; j text := encode(gen_random_bytes(18), 'hex'); r public.inscriptions;
  v_avans numeric; v_total numeric;
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
  if t.avans_htg is not null and t.avans_htg > 0 and t.avans_htg < t.prix_htg then v_avans := t.avans_htg; v_total := t.prix_htg;
  else v_avans := t.prix_htg; v_total := null; end if;

  select * into deja from public.inscriptions where evenement_id = e.id and telephone_cle = cle for update;
  if deja.id is not null and deja.statut <> 'refuse' then
    raise exception 'Nimewo sa a enskri deja. Chèche tikè w nan « Jwenn tikè mwen ».';
  end if;
  if deja.id is not null then
    update public.inscriptions set type_billet_id = t.id, nom = v_nom, telephone = btrim(p_telephone), email = em, reponses = coalesce(p_reponses, '{}'),
      moyen_paiement = p_moyen, reference_paiement = null, montant = v_avans, total_htg = v_total, rete_peye_le = null, rete_peye_pa = null, rete_moyen = null,
      statut = 'en_attente', motif_refus = null, jeton = j, soumis_le = null, cree_le = now()
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
    'moyen', r.moyen_paiement, 'type', t.nom, 'total', coalesce(r.total_htg, r.montant), 'rete', public._rete(r.montant, r.total_htg, r.rete_peye_le));
end $$;

create or replace function public.staf_evenement(p_code text, p_evenement jsonb, p_types jsonb) returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'pri_evenman'); eid uuid := nullif(p_evenement->>'id', '')::uuid; t jsonb;
  g text := nullif(btrim(coalesce(p_evenement->>'lyen_gwoup', '')), '');
begin
  if g is not null and g !~ '^https://' then raise exception 'Lyen gwoup la dwe kòmanse ak https://'; end if;
  for t in select * from jsonb_array_elements(coalesce(p_types, '[]'::jsonb)) loop
    if nullif(t->>'avans_htg', '') is not null and (nullif(t->>'avans_htg', '')::numeric <= 0
       or nullif(t->>'avans_htg', '')::numeric >= coalesce(nullif(t->>'prix_htg', '')::numeric, 0)) then
      raise exception 'Avans lan dwe pi piti pase pri tikè « % » la.', t->>'nom'; end if;
  end loop;
  if eid is null then
    insert into public.evenements (nom, date, lieu, adresse, capacite, statut, lyen_gwoup) values
      (p_evenement->>'nom', (p_evenement->>'date')::timestamptz, p_evenement->>'lieu', p_evenement->>'adresse',
       (p_evenement->>'capacite')::int, coalesce(p_evenement->>'statut', 'ouvert'), g) returning id into eid;
  else
    update public.evenements set nom = p_evenement->>'nom', date = (p_evenement->>'date')::timestamptz, lieu = p_evenement->>'lieu',
      adresse = p_evenement->>'adresse', capacite = (p_evenement->>'capacite')::int, statut = coalesce(p_evenement->>'statut', statut),
      lyen_gwoup = case when p_evenement ? 'lyen_gwoup' then g else lyen_gwoup end
      where id = eid;
  end if;
  for t in select * from jsonb_array_elements(coalesce(p_types, '[]'::jsonb)) loop
    if nullif(t->>'id', '') is null then
      insert into public.types_billets (evenement_id, nom, prix_usd, prix_htg, avans_htg, quota, date_fin_vente, ordre, avantaj) values
        (eid, t->>'nom', nullif(t->>'prix_usd', '')::numeric, nullif(t->>'prix_htg', '')::numeric, nullif(t->>'avans_htg', '')::numeric, (t->>'quota')::int,
         nullif(t->>'date_fin_vente', '')::timestamptz, coalesce((t->>'ordre')::int, 0), coalesce(t->'avantaj', '[]'::jsonb));
    else
      update public.types_billets set nom = t->>'nom', prix_usd = nullif(t->>'prix_usd', '')::numeric, prix_htg = nullif(t->>'prix_htg', '')::numeric,
        avans_htg = case when t ? 'avans_htg' then nullif(t->>'avans_htg', '')::numeric else avans_htg end,
        quota = (t->>'quota')::int, date_fin_vente = nullif(t->>'date_fin_vente', '')::timestamptz, ordre = coalesce((t->>'ordre')::int, 0),
        avantaj = coalesce(t->'avantaj', avantaj)
        where id = (t->>'id')::uuid and evenement_id = eid;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'id', eid);
end $$;

create or replace function public.staf_tablo(p_code text, p_evenement uuid default null) returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); e public.evenements := public._evt(p_evenement); res jsonb;
begin
  if e.id is null then return jsonb_build_object('role', s.role, 'non', s.non, 'evenement', null, 'file', '[]'::jsonb, 'lis', '[]'::jsonb, 'types', '[]'::jsonb); end if;
  res := jsonb_build_object('role', s.role, 'non', s.non, 'evenement', to_jsonb(e), 'file', '[]'::jsonb, 'lis', '[]'::jsonb,
    'types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nom', t.nom, 'prix_usd', t.prix_usd, 'prix_htg', t.prix_htg, 'avans_htg', t.avans_htg, 'quota', t.quota,
        'date_fin_vente', t.date_fin_vente, 'ordre', t.ordre, 'avantaj', coalesce(t.avantaj, '[]'::jsonb), 'restants', public._restants_type(t.id), 'bloke', public._bloke(t.id)) order by t.ordre, t.prix_htg)
      from public.types_billets t where t.evenement_id = e.id), '[]'));
  if public._pe(s.role, 'chif') then
    res := res || jsonb_build_object(
      'chif', (select jsonb_build_object(
        'inscrits', count(*) filter (where statut <> 'refuse'),
        'payes', count(*) filter (where statut = 'valide'),
        'en_attente', count(*) filter (where statut = 'en_attente' and reference_paiement is not null),
        'sans_paiement', count(*) filter (where statut = 'en_attente' and reference_paiement is null),
        'refuses', count(*) filter (where statut = 'refuse'),
        'recettes_htg', coalesce(sum(montant) filter (where statut = 'valide'), 0)
          + coalesce(sum(total_htg - montant) filter (where statut = 'valide' and rete_peye_le is not null), 0),
        'rete_htg', coalesce(sum(public._rete(montant, total_htg, rete_peye_le)) filter (where statut = 'valide'), 0),
        'rete_n', count(*) filter (where statut = 'valide' and public._rete(montant, total_htg, rete_peye_le) > 0))
        from public.inscriptions where evenement_id = e.id),
      'par_jour', coalesce((select jsonb_agg(jsonb_build_object('jour', d, 'n', n) order by d)
        from (select (cree_le at time zone 'America/Port-au-Prince')::date d, count(*) n from public.inscriptions
              where evenement_id = e.id group by 1) x), '[]'),
      'jour_j', (select jsonb_build_object('entres', count(*) filter (where b.statut = 'utilise'), 'attendus', count(*) filter (where b.statut <> 'annule'))
        from public.billets b join public.inscriptions i on i.id = b.inscription_id where i.evenement_id = e.id));
  end if;
  if public._pe(s.role, 'valide_peman') then
    res := res || jsonb_build_object('file', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'code_court', i.code_court, 'nom', i.nom, 'telephone', i.telephone,
        'type', t.nom, 'montant', i.montant, 'total', i.total_htg, 'moyen', i.moyen_paiement, 'reference', i.reference_paiement, 'soumis_le', i.soumis_le,
        'capture', exists (select 1 from public.captures c where c.inscription_id = i.id and c.image is not null)) order by i.soumis_le)
      from public.inscriptions i join public.types_billets t on t.id = i.type_billet_id
      where i.evenement_id = e.id and i.statut = 'en_attente' and i.reference_paiement is not null), '[]'));
  end if;
  if public._pe(s.role, 'lis_enskripsyon') then
    res := res || jsonb_build_object('lis', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'code_court', i.code_court, 'nom', i.nom, 'telephone', i.telephone,
          'email', i.email, 'type', t.nom, 'montant', i.montant, 'total', i.total_htg, 'rete', public._rete(i.montant, i.total_htg, i.rete_peye_le),
          'rete_peye_le', i.rete_peye_le, 'rete_peye_pa', i.rete_peye_pa, 'rete_moyen', i.rete_moyen, 'moyen', i.moyen_paiement, 'reference', i.reference_paiement,
          'statut', i.statut, 'motif', i.motif_refus, 'reponses', i.reponses, 'cree_le', i.cree_le, 'valide_le', i.valide_le, 'valide_par', i.valide_par,
          'billet', b.code, 'billet_statut', b.statut, 'scanne_le', b.scanne_le) order by i.cree_le desc)
        from public.inscriptions i join public.types_billets t on t.id = i.type_billet_id left join public.billets b on b.inscription_id = i.id
        where i.evenement_id = e.id), '[]'));
  elsif public._pe(s.role, 'jwenn_tike') or public._pe(s.role, 'rapel') then
    res := res || jsonb_build_object('lis', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'code_court', i.code_court, 'nom', i.nom, 'telephone', i.telephone,
          'type', t.nom, 'statut', i.statut, 'rete', public._rete(i.montant, i.total_htg, i.rete_peye_le), 'valide_par', i.valide_par,
          'billet', b.code, 'billet_statut', b.statut, 'scanne_le', b.scanne_le) order by i.cree_le desc)
        from public.inscriptions i join public.types_billets t on t.id = i.type_billet_id left join public.billets b on b.inscription_id = i.id
        where i.evenement_id = e.id and i.statut = 'valide'), '[]'));
  end if;
  return res;
end $$;

-- the team records that the rest was paid (cash or MonCash/NatCash), at the door or before
create or replace function public.staf_rete_peye(p_code text, p_id uuid, p_moyen text default 'kach') returns jsonb language plpgsql security definer
set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, null); i public.inscriptions;
begin
  if not (public._pe(s.role, 'valide_peman') or public._pe(s.role, 'enskri_sou_plas') or public._pe(s.role, 'eskane')) then
    raise exception 'Ou pa gen dwa sa a.'; end if;
  if p_moyen not in ('kach', 'moncash', 'natcash') then raise exception 'Chwazi kach, MonCash oswa NatCash.'; end if;
  select * into i from public.inscriptions where id = p_id for update;
  if i.id is null or i.statut <> 'valide' then raise exception 'Enskripsyon sa a pa valide.'; end if;
  if public._rete(i.montant, i.total_htg, i.rete_peye_le) <= 0 then raise exception 'Pa gen anyen ki rete pou peye.'; end if;
  update public.inscriptions set rete_peye_le = now(), rete_peye_pa = s.non, rete_moyen = p_moyen where id = p_id;
  return jsonb_build_object('ok', true, 'peye', i.total_htg - i.montant);
end $$;

-- cash at the venue: the person pays the full price at once
create or replace function public.staf_kach(p_code text, p_type uuid, p_nom text, p_telephone text, p_email text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'enskri_sou_plas'); r jsonb; v jsonb;
begin
  r := public.inscrire(p_type, p_nom, p_telephone, p_email, '{}'::jsonb, 'moncash');
  update public.inscriptions set moyen_paiement = 'especes', reference_paiement = 'KACH-' || (r->>'code_court'), soumis_le = now(),
    montant = coalesce(total_htg, montant), total_htg = null
    where id = (r->>'id')::uuid;
  v := public.staf_valide(p_code, (r->>'id')::uuid);
  return v;
end $$;

create or replace function public.billet_public(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', b.code, 'statut', b.statut, 'numero', i.code_court, 'nom', i.nom, 'type', t.nom,
    'rete', public._rete(i.montant, i.total_htg, i.rete_peye_le),
    'evenement', jsonb_build_object('nom', e.nom, 'date', e.date, 'lieu', e.lieu, 'adresse', e.adresse),
    'gwoup', case when b.statut <> 'annule' then e.lyen_gwoup end)
  from public.billets b join public.inscriptions i on i.id = b.inscription_id
  join public.types_billets t on t.id = i.type_billet_id join public.evenements e on e.id = i.evenement_id
  where b.code = upper(btrim(coalesce(p_code, '')))
$$;

create or replace function public.skane_lis(p_code text, p_evenement uuid default null) returns jsonb language plpgsql stable security definer
set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'eskane'); e public.evenements := public._evt(p_evenement);
begin
  return jsonb_build_object('evenement', jsonb_build_object('id', e.id, 'nom', e.nom, 'date', e.date), 'le', now(),
    'billets', coalesce((select jsonb_agg(jsonb_build_object('code', b.code, 'numero', i.code_court, 'nom', i.nom, 'id', i.id,
        'tel', right(i.telephone_cle, 4), 'type', t.nom, 'statut', b.statut, 'scanne_le', b.scanne_le,
        'rete', public._rete(i.montant, i.total_htg, i.rete_peye_le)))
      from public.billets b join public.inscriptions i on i.id = b.inscription_id join public.types_billets t on t.id = i.type_billet_id
      where i.evenement_id = e.id), '[]'));
end $$;

create or replace function public._wa_eta_konv(p_tel text) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('non', c.non, 'eta', c.eta, 'foto', c.foto is not null,
    'enskripsyon', case when i.id is null then null else jsonb_build_object('code_court', i.code_court, 'statut', i.statut, 'montant', i.montant,
      'total', coalesce(i.total_htg, i.montant), 'rete', public._rete(i.montant, i.total_htg, i.rete_peye_le),
      'moyen', i.moyen_paiement, 'referans_voye', i.reference_paiement is not null, 'tip', t.nom,
      'tike', (select b.code from public.billets b where b.inscription_id = i.id and b.statut <> 'annule' limit 1)) end)
  from public.wa_konv c left join public.inscriptions i on i.id = c.inscription_id left join public.types_billets t on t.id = i.type_billet_id
  where c.telefon = p_tel
$$;

revoke all on function public.staf_rete_peye(text, uuid, text) from public;
grant execute on function public.staf_rete_peye(text, uuid, text) to anon, authenticated;
revoke all on function public._rete(numeric, numeric, timestamptz) from public, anon, authenticated;

-- this event: 1 000 HTG deposit on the 6 500 HTG ticket
update public.types_billets set avans_htg = 1000 where prix_htg = 6500 and avans_htg is null;
