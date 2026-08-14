create table category (
    id       uuid primary key,
    slug     text not null unique,
    name     text not null,
    position int  not null
);

create table product (
    id         uuid primary key,
    slug       text not null unique,
    name       text not null,
    kind       text not null,
    summary    text not null,
    detail     text,
    doc_status text not null check (doc_status in ('confirmed', 'pending')),
    published  boolean not null default false,
    sort_order int not null default 0,
    image_src  text,
    image_alt  text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table product_category (
    product_id  uuid not null references product (id) on delete cascade,
    category_id uuid not null references category (id) on delete restrict,
    primary key (product_id, category_id)
);

create table product_spec (
    id         uuid primary key,
    product_id uuid not null references product (id) on delete cascade,
    kind       text not null check (kind in ('key_param', 'spec')),
    position   int  not null,
    label      text not null,
    value      text not null,
    muted      boolean not null default false
);

create index product_published_idx on product (published, sort_order);
create index product_spec_product_idx on product_spec (product_id, kind, position);
