-- WhatsApp group for people who reserved: the link goes out with the ticket and shows on the ticket page.
alter table public.evenements add column if not exists lyen_gwoup text;

create or replace function public.staf_evenement(p_code text, p_evenement jsonb, p_types jsonb) returns jsonb language plpgsql volatile
security definer set search_path = public, extensions as $$
declare s public.staf := public._staf_a(p_code, 'pri_evenman'); eid uuid := nullif(p_evenement->>'id', '')::uuid; t jsonb;
  g text := nullif(btrim(coalesce(p_evenement->>'lyen_gwoup', '')), '');
begin
  if g is not null and g !~ '^https://' then raise exception 'Lyen gwoup la dwe kòmanse ak https://'; end if;
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
      insert into public.types_billets (evenement_id, nom, prix_usd, prix_htg, quota, date_fin_vente, ordre, avantaj) values
        (eid, t->>'nom', nullif(t->>'prix_usd', '')::numeric, nullif(t->>'prix_htg', '')::numeric, (t->>'quota')::int,
         nullif(t->>'date_fin_vente', '')::timestamptz, coalesce((t->>'ordre')::int, 0), coalesce(t->'avantaj', '[]'::jsonb));
    else
      update public.types_billets set nom = t->>'nom', prix_usd = nullif(t->>'prix_usd', '')::numeric, prix_htg = nullif(t->>'prix_htg', '')::numeric,
        quota = (t->>'quota')::int, date_fin_vente = nullif(t->>'date_fin_vente', '')::timestamptz, ordre = coalesce((t->>'ordre')::int, 0),
        avantaj = coalesce(t->'avantaj', avantaj)
        where id = (t->>'id')::uuid and evenement_id = eid;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'id', eid);
end $$;

-- the group link is only shown on a ticket that is still valid
create or replace function public.billet_public(p_code text) returns jsonb language sql stable
security definer set search_path = public as $$
  select jsonb_build_object('code', b.code, 'statut', b.statut, 'numero', i.code_court, 'nom', i.nom, 'type', t.nom,
    'evenement', jsonb_build_object('nom', e.nom, 'date', e.date, 'lieu', e.lieu, 'adresse', e.adresse),
    'gwoup', case when b.statut <> 'annule' then e.lyen_gwoup end)
  from public.billets b join public.inscriptions i on i.id = b.inscription_id
  join public.types_billets t on t.id = i.type_billet_id join public.evenements e on e.id = i.evenement_id
  where b.code = upper(btrim(coalesce(p_code, '')))
$$;
