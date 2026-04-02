-- KOFEE DATABASE SCHEMA

-- =========================================================
-- TAG VALIDATION FUNCTION
-- =========================================================
create or replace function tags_are_valid(tags text[])
returns boolean as $$
begin
  return tags is null OR not exists (
    select 1
    from unnest(tags) as tag
    where char_length(tag) > 50
  );
end;
$$ language plpgsql immutable;


-- =========================================================
-- SNIPPETS TABLE
-- =========================================================
create table snippets (
  id         uuid default gen_random_uuid() primary key,
  user_id    text not null,
  title      text not null default 'Untitled',
  code       text not null default '',
  lang       text not null default 'js',
  tags       text[] default '{}',
  gist_url   text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  constraint snippets_code_length   check (char_length(code) <= 100000),
  constraint snippets_title_length  check (char_length(title) <= 500),
  constraint snippets_title_notempty check (char_length(trim(title)) > 0),
  constraint snippets_lang_valid    check (lang in ('js','ts','py','css','bash','sql','html','json','other')),
  constraint snippets_tags_count    check (array_length(tags, 1) <= 20 or tags = '{}'),
  constraint snippets_tag_length    check (tags_are_valid(tags))
);

alter table snippets enable row level security;

create policy "Users can manage their own snippets"
  on snippets for all
  using  (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create index snippets_user_id_idx  on snippets (user_id);
create index snippets_updated_at_idx on snippets (updated_at desc);


-- =========================================================
-- USER TOKENS TABLE
-- =========================================================
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


-- =========================================================
-- SHARED SNIPPETS TABLE
-- =========================================================
create table shared_snippets (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  title      text not null,
  code       text not null,
  lang       text not null default 'js',
  tags       text[] default '{}',
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone default now() + interval '7 days',

  constraint shared_snippets_code_length  check (char_length(code) <= 100000),
  constraint shared_snippets_title_length check (char_length(title) <= 500),
  constraint shared_snippets_lang_valid   check (lang in ('js','ts','py','css','bash','sql','html','json','other')),
  constraint shared_snippets_tags_count   check (array_length(tags, 1) <= 20 or tags = '{}'),
  constraint shared_snippets_tag_length   check (tags_are_valid(tags))
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


-- =========================================================
-- CLEANUP FUNCTION
-- =========================================================
create or replace function delete_expired_shares()
returns void as $$
begin
  delete from shared_snippets where expires_at < now();
end;
$$ language plpgsql security definer set search_path = public;


-- =========================================================
-- REPORTS TABLE
-- =========================================================
create table snippet_reports (
  id         uuid default gen_random_uuid() primary key,
  snippet_id uuid not null references shared_snippets(id) on delete cascade,
  reason     text not null default 'user_report',
  created_at timestamp with time zone default now()
);

alter table snippet_reports enable row level security;

create policy "Anyone can report a snippet"
  on snippet_reports for insert
  with check (true);


-- =========================================================
-- REPORT LIMIT TRIGGER
-- =========================================================
create or replace function check_report_limit()
returns trigger as $$
begin
  if (
    select count(*) from snippet_reports
    where snippet_id = new.snippet_id
  ) >= 10 then
    raise exception 'Report limit reached for this snippet';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger enforce_report_limit
  before insert on snippet_reports
  for each row
  execute function check_report_limit();


-- =========================================================
-- SNIPPET LIMIT TRIGGER
-- =========================================================
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
$$ language plpgsql security definer set search_path = public;

create trigger enforce_snippet_limit
  before insert on snippets
  for each row
  execute function check_snippet_limit();


-- =========================================================
-- CRON JOB (DELETE EXPIRED SHARES)
-- =========================================================
-- Requires pg_cron extension enabled in Supabase
select cron.schedule(
  'delete-expired-shares',
  '0 3 * * *',
  'select delete_expired_shares()'
);