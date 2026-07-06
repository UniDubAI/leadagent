-- Business mini-page generator (Linktree-style public pages sold to clients)
create table if not exists biz_pages (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  business_name text not null,
  tagline       text,
  phone         text,
  address       text,
  instagram     text,
  telegram      text,
  facebook      text,
  website       text,
  menu_url      text,
  working_hours text,
  reviews       jsonb not null default '[]'::jsonb,
  theme         text not null default 'brown',
  lead_id       uuid references leads(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists biz_pages_slug_idx on biz_pages(slug);
