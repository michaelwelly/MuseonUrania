-- Автоочистка по сроку хранения: разговоры и письма, вслед за заявкой (V18).
--
-- Issue #47: заявка несёт персональные данные, хранить их бессрочно нельзя,
-- но и удалять по неверному сроку нельзя тем более — удаление необратимо,
-- а бэкапов, откуда восстановить, тоже нет (docs/PROJECT.md, 12.2). Механизм
-- заводится здесь, а включается отдельно, в коде: без свойства
-- vedal.privacy.retention.chat / .mail соответствующий бин не создаётся вовсе.
--
-- ————— разговор —————
--
-- Колонки erased_at и erasure_basis у conversation уже есть — их завела V17
-- вместе с самой таблицей, для обезличивания по обращению субъекта. Здесь
-- только индекс под выборку автоочистки: те же рассуждения, что у
-- lead_retention_idx из V18 — частичный, потому что обезличенные из выборки
-- уходят навсегда, и держать под них место в индексе незачем.
create index conversation_retention_idx on conversation (started_at) where erased_at is null;

-- ————— письмо —————
--
-- У outbound_mail таких колонок ещё не было: письмо до сих пор не считалось
-- носителем персональных данных, требующим отдельного обезличивания. Это
-- неверно — адрес получателя и есть персональные данные, а письмо клиенту
-- уходит на его личный ящик.
alter table outbound_mail add column erased_at     timestamptz;
alter table outbound_mail add column erasure_basis text;

comment on column outbound_mail.erased_at is
    'Когда персональные данные письма уничтожены. NULL — не уничтожались.';
comment on column outbound_mail.erasure_basis is
    'Основание: обращение субъекта или истечение срока хранения.';

alter table outbound_mail add constraint outbound_mail_erasure_has_basis
    check ((erased_at is null and erasure_basis is null)
        or (erased_at is not null and erasure_basis is not null));

create index outbound_mail_retention_idx on outbound_mail (created_at) where erased_at is null;

-- ————— права —————
--
-- Новых таблиц миграция не заводит. Права роли рантайма из V15/V16 выданы
-- на таблицу, а не на колонку, и действуют на новые колонки без единой
-- дополнительной строки.
