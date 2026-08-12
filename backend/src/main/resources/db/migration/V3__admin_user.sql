create table admin_user (
    id            uuid primary key,
    username      text not null unique,
    password_hash text not null,
    display_name  text not null,
    enabled       boolean not null default true,
    created_at    timestamptz not null default now()
);
