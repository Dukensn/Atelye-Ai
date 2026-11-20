-- Registration: the person may pay the registration fee only, or everything at once (p_tout).
drop function if exists public.inscrire(uuid, text, text, text, jsonb, text);
create or replace function public.inscrire(p_type uuid, p_nom text, p_telephone text, p_email text default null,
  p_reponses jsonb default '{}'::jsonb, p_moyen text default 'moncash', p_tout boolean default false) returns jsonb language plpgsql security definer
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
  if not coalesce(p_tout, false) and t.avans_htg is not null and t.avans_htg > 0 and t.avans_htg < t.prix_htg then v_avans := t.avans_htg; v_total := t.prix_htg;
  else v_avans := t.prix_htg; v_total := null; end if;

  select * into deja from public.inscriptions where evenement_id = e.id and telephone_cle = cle for update;
  -- the same number may start again while no payment proof was sent yet (it keeps its code)
  if deja.id is not null and deja.statut <> 'refuse' and not (deja.statut = 'en_attente' and deja.reference_paiement is null) then
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
revoke all on function public.inscrire(uuid, text, text, text, jsonb, text, boolean) from public;
grant execute on function public.inscrire(uuid, text, text, text, jsonb, text, boolean) to anon, authenticated;
