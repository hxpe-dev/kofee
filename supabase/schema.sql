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
