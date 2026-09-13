alter table conversation
    add column board_summary varchar(600) not null default '',
    add column stage varchar(32) not null default 'new'
        check (stage in ('new','clarification','selection','ready_for_quote','handed_to_human','closed')),
    add column importance varchar(16) not null default 'normal' check (importance in ('normal','high','urgent')),
    add column next_action varchar(600) not null default 'Уточнить задачу посетителя',
    add column board_updated_at timestamptz not null default now(),
    add column board_manual boolean not null default false;
update conversation set stage = case when status = 'closed' then 'closed'
    when status in ('waiting','attended') then 'handed_to_human' else 'new' end,
    next_action = case when status = 'closed' then 'Работа завершена'
    when status in ('waiting','attended') then 'Ответить посетителю' else 'Уточнить задачу посетителя' end,
    board_updated_at = last_at;
update conversation c set board_summary = left(m.body, 600)
from (select distinct on (conversation_id) conversation_id, body from chat_message
      where author = 'visitor' and length(body) >= 12 order by conversation_id, at desc) m
where m.conversation_id = c.id and c.erased_at is null;
create index conversation_board_idx on conversation(board_updated_at desc, id) where erased_at is null;
-- One transactional queue entry per Moscow calendar date, including concurrent schedulers.
alter table outbound_mail add column dedup_key varchar(100) unique;
