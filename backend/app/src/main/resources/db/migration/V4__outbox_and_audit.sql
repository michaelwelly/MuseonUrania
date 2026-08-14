-- Транзакционный outbox: строка сущности и строка события коммитятся одним
-- COMMIT. Прямая публикация из обработчика запрещена — между INSERT и отправкой
-- есть щель, в которую проваливаются заявки.
create table outbox (
    id           uuid primary key,
    aggregate    text not null,
    aggregate_id text not null,
    type         text not null,
    payload      jsonb not null,
    created_at   timestamptz not null default now(),
    published_at timestamptz
);

-- По этому индексу работает relay и считается лаг: только неопубликованные.
create index outbox_unpublished_idx on outbox (published_at, id) where published_at is null;

create table audit_entry (
    id             uuid primary key,
    at             timestamptz not null default now(),
    actor          text not null,
    action         text not null,
    subject        text not null,
    subject_id     text,
    correlation_id text,
    ip             text,
    payload        jsonb
);

create index audit_entry_at_idx on audit_entry (at desc);
create index audit_entry_subject_idx on audit_entry (subject, subject_id);

-- Журнал только дописывается. Запрет на уровне базы, а не соглашения в коде:
-- журнал, который можно поправить задним числом, бесполезен при разборе
-- инцидента, а отзыв прав у приложения — отдельная задача администратора,
-- которую легко забыть при развёртывании новой среды.
create or replace function audit_entry_append_only() returns trigger as $$
begin
    raise exception 'audit_entry is append-only: % is not allowed', tg_op;
end;
$$ language plpgsql;

create trigger audit_entry_no_update before update on audit_entry
    for each statement execute function audit_entry_append_only();

create trigger audit_entry_no_delete before delete on audit_entry
    for each statement execute function audit_entry_append_only();
