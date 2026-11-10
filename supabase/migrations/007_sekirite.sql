-- Hardening after the full check of 10 Nov 2026.
-- 1. WhatsApp tables: same rule as the others — no direct table rights for the public roles (only the RPC functions).
revoke all on public.wa_konfig, public.wa_konv, public.wa_mesaj from anon, authenticated;
revoke all on sequence public.wa_mesaj_id_seq from anon, authenticated;
-- 2. fixed search_path on the three small helpers the linter flagged
alter function public._tel_cle(text) set search_path = public;
alter function public._akse_tout() set search_path = public;
alter function public._akse_non(text) set search_path = public;
-- 3. indexes on foreign keys (lists and joins stay fast as sign-ups grow)
create index if not exists inscriptions_type_idx on public.inscriptions (type_billet_id);
create index if not exists scans_billet_idx on public.scans (billet_id);
create index if not exists staf_sesyon_staf_idx on public.staf_sesyon (staf_id);
create index if not exists types_billets_evt_idx on public.types_billets (evenement_id);
create index if not exists wa_konv_ins_idx on public.wa_konv (inscription_id);
create index if not exists wol_chanjman_pa_idx on public.wol_chanjman (pwopoze_pa);
