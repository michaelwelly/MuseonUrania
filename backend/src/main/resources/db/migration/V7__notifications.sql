-- Потребители событий идемпотентны, обработанные идентификаторы лежат здесь.
-- Уникальность на уровне базы: повторная доставка одного события не должна
-- приводить ко второму письму.
create table event_consumed (
    id       uuid primary key,
    consumer text not null,
    event_id uuid not null,
    at       timestamptz not null default now()
);

create unique index event_consumed_idx on event_consumed (consumer, event_id);

-- Исходящие письма. Наружу уходит только шаблонное письмо: тело собирается
-- из шаблона внутри модуля, снаружи передать произвольный текст нельзя.
create table outbound_mail (
    id             uuid primary key,
    template       text not null,
    to_address     text not null,
    subject        text not null,
    body           text not null,
    lead_id        uuid,
    correlation_id text,

    -- failed — это и есть DLQ: письмо, не ушедшее после ретраев, разбирается
    -- руками, а не крутится в очереди вечно.
    status         text not null check (status in ('queued', 'sent', 'failed')),
    attempts       int  not null default 0,
    last_error     text,
    created_at     timestamptz not null default now(),
    sent_at        timestamptz,

    constraint outbound_mail_sent_has_time check (status <> 'sent' or sent_at is not null)
);

create index outbound_mail_queued_idx on outbound_mail (created_at) where status = 'queued';
