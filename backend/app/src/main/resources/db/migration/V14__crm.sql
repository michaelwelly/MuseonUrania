-- CRM: клиенты, сделки, коммерческие предложения, история переписки,
-- вложения из согласованных документов.
--
-- До этой миграции модуль crm умел одно: принять заявку и разобрать её
-- (статус и ответственный). Всё, что идёт после разбора, — здесь.
--
-- Клиентская база и коммерческие условия живут в закрытом контуре: наружу
-- ни одна из этих таблиц не отдаётся, публичное API про них не знает.

-- 1. Атрибуция заявки.
--
-- Аналитика требуется «по изделию, источнику, языку и кампании». Изделие
-- и источник в заявке уже есть, языка и кампании не было — без них два
-- из четырёх разрезов посчитать нечем.
--
-- Заводим на lead, а не на deal: это свойство того, откуда человек пришёл,
-- а не того, как с ним потом работали. Сделка, заведённая руками, атрибуции
-- не имеет — и это честно, её никто не приводил.
alter table lead add column language text;
alter table lead add column campaign text;

-- Двухбуквенный код, а не список значений: сайт планируется на ru/en/zh,
-- следом хинди. Список пришлось бы расширять миграцией на каждый новый язык,
-- и до неё заявки с нового домена отбивались бы базой.
alter table lead add constraint lead_language_check
    check (language is null or language ~ '^[a-z]{2}$');
alter table lead add constraint lead_campaign_check
    check (campaign is null or length(campaign) <= 200);

create index lead_campaign_idx on lead (campaign) where campaign is not null;

-- 2. Клиент.
--
-- Отдельно от заявки: заявок от одной больницы может быть десять, клиент —
-- один. Слить их в одну таблицу значит потерять историю отношений при второй
-- же заявке.
create table client (
    id          uuid primary key,

    name        text not null,
    kind        text not null check (kind in ('company', 'person')),

    -- Реквизиты под будущий обмен с 1С. Интеграция не подтверждена (открытый
    -- вопрос 12.4), поэтому колонки есть, а обмена нет: добавить их потом —
    -- это миграция плюс правка каждой формы и каждого запроса, а завести
    -- сразу почти ничего не стоит.
    inn         text check (inn is null or inn ~ '^\d{10}$|^\d{12}$'),
    kpp         text check (kpp is null or kpp ~ '^\d{9}$'),

    -- Идентификатор той же организации во внешней системе. Уникален, когда
    -- задан: два клиента портала, указывающие на одного контрагента 1С, —
    -- это расхождение, которое обмен разнесёт по обеим системам.
    external_id text,

    country     text,
    city        text,

    -- Персональные данные. В топики и в журнал не уезжают — только id клиента.
    email       text,
    phone       text,

    note        text,
    owner       text,

    -- Два менеджера, открывшие одну карточку, не затирают правки друг друга.
    version     bigint not null default 0,

    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create unique index client_external_id_idx on client (external_id) where external_id is not null;
-- ИНН — естественный ключ организации. Заводить второго клиента с тем же ИНН
-- значит развести историю одной больницы по двум карточкам.
create unique index client_inn_idx on client (inn) where inn is not null;
create index client_name_idx on client (lower(name));

-- 3. Сделка.
--
-- Три воронки из functional_requirements: продажи, дилерская и сервисная.
-- Одна таблица с разными наборами стадий, а не три таблицы: у них общая
-- карточка, общий ответственный, общая история и общая аналитика — разводить
-- их значит трижды написать одно и то же.
create table deal (
    id           uuid primary key,

    client_id    uuid not null references client (id) on delete restrict,

    -- Откуда пришла. Пусто у сделки, заведённой руками.
    lead_id      uuid references lead (id) on delete set null,

    pipeline     text not null check (pipeline in ('sales', 'dealer', 'service')),
    title        text not null,

    -- Набор стадий у каждой воронки свой, и проверка это учитывает: стадия
    -- 'repair' в воронке продаж — не опечатка редактора, а рассыпавшаяся
    -- аналитика. То же правило продублировано в Pipelines, чтобы форма
    -- нарисовала выбор; здесь оно закрыто так, что его не обойти.
    stage        text not null,
    constraint deal_stage_check check (
        (pipeline = 'sales'   and stage in ('new', 'qualified', 'quoted', 'won', 'lost')) or
        (pipeline = 'dealer'  and stage in ('new', 'talks', 'agreement', 'active', 'declined')) or
        (pipeline = 'service' and stage in ('new', 'diagnostics', 'repair', 'closed', 'declined'))
    ),

    -- Коммерческие условия. Наружу не уходят никогда: ни в публичное API,
    -- ни в топики, ни в письма клиенту.
    amount       numeric(14, 2) check (amount is null or amount >= 0),
    currency     text not null default 'RUB' check (currency ~ '^[A-Z]{3}$'),

    product_slug text references product (slug) on update cascade on delete set null,

    owner        text,

    closed_at    timestamptz,
    -- Причина проигрыша. Без неё воронка показывает, сколько потеряли,
    -- и молчит о том, почему.
    lost_reason  text,

    version      bigint not null default 0,

    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- Заявка разбирается один раз. Без этого двойное нажатие «завести сделку»
-- создаёт две сделки по одному обращению, и обе попадают в аналитику.
create unique index deal_lead_idx on deal (lead_id) where lead_id is not null;

create index deal_client_idx on deal (client_id, created_at desc);
create index deal_pipeline_idx on deal (pipeline, stage, created_at desc);
create index deal_owner_idx on deal (owner) where owner is not null;

-- 4. Коммерческое предложение.
create sequence quote_number_seq;

create table quote (
    id          uuid primary key,

    deal_id     uuid not null references deal (id) on delete cascade,

    -- Номер, который клиент видит в переписке. Уникален: два КП с одним
    -- номером — это спор о том, какое из них действующее.
    number      text not null unique,

    status      text not null check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),

    currency    text not null default 'RUB' check (currency ~ '^[A-Z]{3}$'),
    valid_until date,
    note        text,

    -- Сумма считается из позиций и хранится: КП, отправленное клиенту,
    -- обязано показывать ту сумму, которая в нём была, а не пересчитанную
    -- по сегодняшнему прайсу.
    total       numeric(14, 2) not null default 0 check (total >= 0),

    sent_at     timestamptz,
    decided_at  timestamptz,

    version     bigint not null default 0,

    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    -- Отправленное КП обязано помнить, когда его отправили: без отметки
    -- срок действия не от чего считать.
    constraint quote_sent_has_date check (status = 'draft' or sent_at is not null)
);

create index quote_deal_idx on quote (deal_id, created_at desc);
create index quote_status_idx on quote (status, created_at desc);

create table quote_item (
    id           uuid primary key,

    quote_id     uuid not null references quote (id) on delete cascade,
    position     int not null,

    -- Ссылка на каталог необязательна: в КП попадают и позиции, которых
    -- в каталоге нет — монтаж, обучение, доставка.
    product_slug text references product (slug) on update cascade on delete set null,

    -- Наименование в КП, а не в каталоге: переименование изделия не должно
    -- задним числом менять уже отправленное предложение.
    name         text not null,

    quantity     numeric(12, 3) not null check (quantity > 0),
    unit_price   numeric(14, 2) not null check (unit_price >= 0),
    amount       numeric(14, 2) not null check (amount >= 0),

    -- Порядок позиций в КП уникален — две строки на первом месте это спор
    -- о том, как выглядит отправленный документ.
    --
    -- deferrable initially deferred здесь обязателен, и это не послабление.
    -- Позиции заменяются целиком: домен чистит список и добавляет новый,
    -- а Hibernate в одном сбросе вставляет новую строку с позицией 0 раньше,
    -- чем удаляет старую. С немедленной проверкой правка КП падала бы
    -- на пустом месте. Отложенная проверка выполняется на COMMIT, когда
    -- старых строк уже нет: правило остаётся строгим, порядок операций
    -- внутри транзакции перестаёт иметь значение.
    constraint quote_item_position_unique unique (quote_id, position)
        deferrable initially deferred
);

-- 5. История переписки и звонков.
--
-- Только дописывается, как и журнал: история, которую можно поправить задним
-- числом, не история. Поэтому здесь нет колонки version — править нечего.
create table interaction (
    id         uuid primary key,

    -- Запись привязана к сделке, к клиенту или к заявке. Хотя бы к чему-то:
    -- висящая в воздухе запись переписки не находится ни из одной карточки.
    deal_id    uuid references deal (id) on delete cascade,
    client_id  uuid references client (id) on delete cascade,
    lead_id    uuid references lead (id) on delete cascade,
    constraint interaction_has_subject check (
        deal_id is not null or client_id is not null or lead_id is not null
    ),

    kind       text not null check (kind in ('call', 'email', 'meeting', 'note')),
    direction  text check (direction is null or direction in ('in', 'out')),

    at         timestamptz not null default now(),
    subject    text,
    -- Содержимое переписки. Персональные данные: в топики и в журнал не уезжает.
    body       text not null,

    actor      text not null,
    created_at timestamptz not null default now()
);

create index interaction_deal_idx on interaction (deal_id, at desc);
create index interaction_client_idx on interaction (client_id, at desc);
create index interaction_lead_idx on interaction (lead_id, at desc);

-- 6. Вложения из согласованных документов.
--
-- К сделке прикладывается не файл, а ссылка на карточку документа: копия
-- файла разошлась бы с оригиналом на первой же замене ревизии.
--
-- on delete restrict у документа: удалить документ, приложенный к сделке,
-- нельзя. Иначе из карточки сделки пропадает то, что клиенту уже отправили.
create table deal_document (
    deal_id     uuid not null references deal (id) on delete cascade,
    document_id uuid not null references document (id) on delete restrict,

    attached_by text not null,
    attached_at timestamptz not null default now(),

    primary key (deal_id, document_id)
);

create index deal_document_document_idx on deal_document (document_id);
