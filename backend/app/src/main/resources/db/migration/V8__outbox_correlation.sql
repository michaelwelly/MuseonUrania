-- Событие несёт correlation_id запроса, который его породил.
--
-- Без этого цепочка обрывается на границе планировщика: заявку принимает поток
-- HTTP-запроса, а relay и потребители работают в потоке расписания, где MDC
-- пуст. Инцидент «заявка принята, письмо не ушло» тогда не связать в одну
-- цепочку, а именно для этого correlation_id и нужен.
alter table outbox add column correlation_id text;

create index outbox_correlation_idx on outbox (correlation_id);
