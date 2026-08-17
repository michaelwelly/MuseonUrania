-- Заявка с сайта, Яндекс Формы или разбора почты. Единственная запись снаружи
-- идёт через Forms API, источник истины один.
create table lead (
    id              uuid primary key,
    form            text not null check (form in ('quote', 'catalog', 'consultation', 'service', 'partner')),
    name            text not null,
    company         text,
    phone           text not null,
    email           text not null,
    product_slug    text,
    message         text not null,

    -- Храним не галочку, а версию текста согласия и время. Через год иначе
    -- не доказать, с чем именно согласился человек.
    consent_version text not null,
    consent_at      timestamptz not null,

    source          text not null check (source in ('site', 'yandex_form', 'email')),
    status          text not null check (status in ('draft', 'new', 'in_progress', 'won', 'lost')),
    owner           text,

    correlation_id  text,
    idempotency_key text,
    created_at      timestamptz not null default now()
);

-- Повтор с тем же ключом обязан вернуть тот же ответ и не создать вторую заявку.
-- Уникальность на уровне базы, а не проверки в коде: две одновременные отправки
-- проходят проверку обе, а вставку — только одна.
create unique index lead_idempotency_key_idx on lead (idempotency_key) where idempotency_key is not null;

create index lead_created_idx on lead (created_at desc);
create index lead_status_idx on lead (status, created_at desc);
