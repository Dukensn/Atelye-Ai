-- Workshop (atelye konferans) registrations. Only the server (service-role key) reads and writes:
-- RLS is on with no policy, so the public anon key sees nothing.
create table if not exists public.konferans_enskripsyon (
  id uuid primary key default gen_random_uuid(),
  non text not null check (char_length(non) between 2 and 80),
  telefon text not null check (char_length(telefon) <= 20),
  telefon_kle text not null unique,
  metod text check (metod in ('moncash', 'natcash')),
  tranzaksyon text check (char_length(tranzaksyon) <= 40),
  estati text not null default 'atann' check (estati in ('atann', 'peye', 'refize')),
  kreye timestamptz not null default now(),
  dat_desizyon timestamptz
);
alter table public.konferans_enskripsyon enable row level security;
