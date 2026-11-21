-- Wish List — cole tudo isto no Supabase: SQL Editor > New query > Run.
-- Cria só a tabela "wishlist". Não mexe em nada do Folio. Pode rodar mais de uma vez.

create table if not exists public.wishlist (
  id uuid primary key,
  url text default '',
  title text default '',
  price numeric,
  currency text default 'BRL',     -- BRL | PYG | USD | EUR
  store text default '',
  image text default '',
  notes text default '',
  bought boolean default false,
  bought_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted boolean default false,
  server_ts timestamptz default now()
);

-- carimbo de hora do servidor (usado na sincronização entre aparelhos)
create or replace function public.wish_touch() returns trigger as $$
begin
  new.server_ts := now();
  return new;
end; $$ language plpgsql;

drop trigger if exists t_wishlist on public.wishlist;
create trigger t_wishlist before insert or update on public.wishlist
  for each row execute function public.wish_touch();

create index if not exists wishlist_ts on public.wishlist (server_ts);

-- acesso (sem login, igual ao Folio): quem tiver a chave do app consegue ler e gravar
alter table public.wishlist enable row level security;
drop policy if exists "wish_all" on public.wishlist;
create policy "wish_all" on public.wishlist for all to anon using (true) with check (true);

-- avisa os outros aparelhos na hora em que algo muda
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wishlist') then
    alter publication supabase_realtime add table public.wishlist;
  end if;
end $$;
