-- KOFEE DATABASE SCHEMA

-- Snippets table

create table snippets (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,
  title      text not null default 'Untitled',
  code       text not null default '',
  lang       text not null default 'js',
  tags       text[] default '{}',
  gist_url   text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table snippets enable row level security;

create policy "Users can manage their own snippets"
  on snippets for all
  using  (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create index snippets_user_id_idx on snippets (user_id);
create index snippets_updated_at_idx on snippets (updated_at desc);


-- User tokens table

create table user_tokens (
  user_id      text primary key,
  github_token text not null,
  updated_at   timestamp with time zone default now()
);

alter table user_tokens enable row level security;

create policy "Users manage their own token"
  on user_tokens for all
  using  (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);


-- Shared snippets table

create table shared_snippets (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  title      text not null,
  code       text not null,
  lang       text not null default 'js',
  tags       text[] default '{}',
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone default now() + interval '7 days'
);

alter table shared_snippets enable row level security;

create policy "Anyone can read shared snippets"
  on shared_snippets for select
  using (expires_at > now());

create policy "Owners can create shared snippets"
  on shared_snippets for insert
  with check (auth.uid()::text = user_id);

create policy "Owners can delete shared snippets"
  on shared_snippets for delete
  using (auth.uid()::text = user_id);

-- Cleanup function for expired shares
create or replace function delete_expired_shares()
returns void as $$
begin
  delete from shared_snippets where expires_at < now();
end;
$$ language plpgsql security definer set search_path = public;


-- Reports table
create table snippet_reports (
  id         uuid default gen_random_uuid() primary key,
  snippet_id uuid not null references shared_snippets(id) on delete cascade,
  reason     text not null default 'user_report',
  created_at timestamp with time zone default now()
);
alter table snippet_reports enable row level security;

-- Anyone can insert a report (even unauthenticated)
create policy "Anyone can report a snippet"
  on snippet_reports for insert
  with check (true);

-- Only service role can read reports (you, via Supabase dashboard)
-- No select policy = only service role can read


-- Size limits on code columns
alter table snippets
  add constraint snippets_code_length check (char_length(code) <= 100000);

alter table snippets
  add constraint snippets_title_length check (char_length(title) <= 500);

alter table shared_snippets
  add constraint shared_snippets_code_length check (char_length(code) <= 100000);


-- Snippet limit trigger 

create or replace function check_snippet_limit()
returns trigger as $$
begin
  if (
    select count(*) from snippets
    where user_id = new.user_id
  ) >= 100 then
    raise exception 'Snippet limit reached (100 max)';
  end if;
  return new;
end;
$$ language plpgsql
   security definer
   set search_path = public;

create trigger enforce_snippet_limit
  before insert on snippets
  for each row
  execute function check_snippet_limit();


-- Delete expired shares every day at 3am (using pg_cron extension, Supabase -> Database -> Extensions -> pg_cron -> Enable)
select cron.schedule(
  'delete-expired-shares',
  '0 3 * * *',  -- runs at 3am every day
  'select delete_expired_shares()'
);