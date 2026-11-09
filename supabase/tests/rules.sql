\set ON_ERROR_STOP 0
select public.staf_premye_admin('Duke', 'sekre-admin-123');
set role anon;
\echo == anon cannot read tables
select count(*) from public.inscriptions;
\echo == anon cannot create admin
select public.staf_premye_admin('X', 'aaaaaaaaaaaa');
\echo == event before prices
select public.evenement_public() ->> 'restants' as restants, public.evenement_public() -> 'types' as types;
\echo == set prices via staff
select public.staf_evenement('sekre-admin-123', jsonb_build_object('id',(public.evenement_public()->>'id'),'nom','Atelye konferans Atelye AI','date','2026-11-28T10:00:00-05:00','lieu','Lise Anacaona','adresse','Leyogàn','capacite',100),
  '[{"nom":"Lève-tôt","prix_usd":"15","prix_htg":"2000","quota":2,"date_fin_vente":"2026-11-20T00:00:00-05:00","ordre":0},{"nom":"Estanda","prix_usd":"20","prix_htg":"2600","quota":98,"ordre":1},{"nom":"Ansyen (fini)","prix_htg":"1","quota":5,"date_fin_vente":"2020-01-01T00:00:00Z"}]');
select jsonb_pretty(public.evenement_public());
\echo == register
select public.inscrire((select (x->>'id')::uuid from jsonb_array_elements(public.evenement_public()->'types') x where x->>'nom'='Lève-tôt'), 'Roselande Pierre', '3864 1234', null, '{"nivo":"debutan"}', 'moncash') as r \gset
\echo :r
select public.inscrire((select (x->>'id')::uuid from jsonb_array_elements(public.evenement_public()->'types') x where x->>'nom'='Lève-tôt'), 'Roselande P', '+509 38641234', null, '{}', 'moncash');
\echo == bad inputs
select public.inscrire((select (x->>'id')::uuid from jsonb_array_elements(public.evenement_public()->'types') x where x->>'nom'='Estanda'), 'A', '123', null, '{}', 'moncash');
select public.inscrire((select (x->>'id')::uuid from jsonb_array_elements(public.evenement_public()->'types') x where x->>'nom'='Estanda'), 'Jean', '37001122', 'not-an-email', '{}', 'moncash');
\echo == submit payment with screenshot
select public.soumettre_paiement((:'r'::jsonb->>'id')::uuid, :'r'::jsonb->>'jeton', 'mc-998877', encode('fakeimage'::bytea,'base64'), 'image/jpeg');
select public.soumettre_paiement((:'r'::jsonb->>'id')::uuid, 'wrong', 'mc-998877');
\echo == second person reuses the same reference
select public.inscrire((select (x->>'id')::uuid from jsonb_array_elements(public.evenement_public()->'types') x where x->>'nom'='Lève-tôt'), 'Wilner Jean', '37001122', 'w@x.ht', '{}', 'natcash') as r2 \gset
select public.soumettre_paiement((:'r2'::jsonb->>'id')::uuid, :'r2'::jsonb->>'jeton', 'MC-998877');
\echo == wrong staff code / scanner cannot validate
select public.staf_tablo('nope');
select public.staf_kreye('sekre-admin-123', 'Mika', 'scanneur', 'skane-kod-456');
select public.staf_valide('skane-kod-456', (:'r'::jsonb->>'id')::uuid);
\echo == queue + validate
select jsonb_array_length(public.staf_tablo('sekre-admin-123')->'file') as file, public.staf_tablo('sekre-admin-123')->'chif' as chif;
select public.staf_kapti('sekre-admin-123', (:'r'::jsonb->>'id')::uuid) ->> 'type';
select public.staf_valide('sekre-admin-123', (:'r'::jsonb->>'id')::uuid) as v \gset
\echo :v
\echo == same reference cannot validate twice
select public.staf_valide('sekre-admin-123', (:'r2'::jsonb->>'id')::uuid);
select public.staf_refize('sekre-admin-123', (:'r2'::jsonb->>'id')::uuid, 'Referans deja itilize');
\echo == refused person can register again, early-bird quota (2) then full
select public.inscrire((select (x->>'id')::uuid from jsonb_array_elements(public.evenement_public()->'types') x where x->>'nom'='Lève-tôt'), 'Wilner Jean', '37001122', null, '{}', 'natcash') ->> 'code_court';
select public.staf_kach('sekre-admin-123', (select (x->>'id')::uuid from jsonb_array_elements(public.evenement_public()->'types') x where x->>'nom'='Lève-tôt'), 'Kach Moun', '34000001') ->> 'billet' as kach;
select (x->>'nom') nom, x->>'restants' restants from jsonb_array_elements(public.evenement_public()->'types') x;
select public.staf_valide('sekre-admin-123', (select (x->>'id')::uuid from jsonb_array_elements(public.staf_tablo('sekre-admin-123')->'lis') x where x->>'nom'='Wilner Jean'));
\echo == ticket page + find ticket
select public.billet_public(:'v'::jsonb->>'billet');
select public.retrouver_billet('38641234', 'xx');
select public.retrouver_billet('38641234', (:'r'::jsonb->>'code_court'));
\echo == scanner: list, scan twice, unknown, cancelled
select jsonb_array_length(public.skane_lis('skane-kod-456')->'billets') as n;
select public.skane_sync('skane-kod-456', 'tel-1', jsonb_build_array(jsonb_build_object('code', :'v'::jsonb->>'billet','le','2026-11-28T14:05:00Z'), jsonb_build_object('code', :'v'::jsonb->>'billet','le','2026-11-28T14:06:00Z'), jsonb_build_object('code','ZZZZZZZZZZZZ')));
select public.staf_anile('sekre-admin-123', (:'r'::jsonb->>'id')::uuid, true);
select public.skane_sync('skane-kod-456', 'tel-2', jsonb_build_array(jsonb_build_object('code', :'v'::jsonb->>'billet')));
select public.staf_tablo('sekre-admin-123') -> 'jour_j', public.staf_tablo('sekre-admin-123') -> 'chif';
reset role;
