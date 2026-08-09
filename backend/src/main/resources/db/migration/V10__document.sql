create table document (
    id           uuid primary key,
    slug         text not null unique,
    title        text not null,
    doc_group    text not null check (doc_group in ('Лицензирование', 'Система качества', 'Техническая документация', 'Коммерческие материалы')),

    -- К чему относится документ: «ООО «ВЕДАЛ»», «Все изделия», «Производство»
    -- или конкретное изделие. product_slug заполняется только во втором случае.
    subject      text not null,
    product_slug text references product (slug) on delete set null,

    sensitivity  text not null check (sensitivity in ('public', 'internal', 'confidential')),

    -- Планируемый уровень доступа, показывается бейджем на сайте.
    access       text not null check (access in ('pdf', 'on_request', 'pending')),

    -- listed — строка видна в публичном перечне. published — файл скачивается.
    -- Это разные вещи: страница «Документы» перечисляет документы вместе со
    -- статусом доступа, даже когда файла ещё нет и строка ведёт на запрос.
    listed       boolean not null default false,
    published    boolean not null default false,

    language     text not null default 'ru',
    storage_key  text,
    file_size    bigint,
    revision     text,
    source_owner text,
    approved_by  text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    -- Внутренний или конфиденциальный документ не может стать публично
    -- скачиваемым. Свойство схемы, а не дисциплины редактора: сервисные
    -- инструкции, конструкторская и производственная документация публично
    -- не размещаются (content_and_seo_plan.md → Sensitive Data Split).
    constraint document_public_only check (not published or sensitivity = 'public'),

    -- Публикация без файла обещает скачивание, которого нет.
    constraint document_published_has_file check (not published or storage_key is not null),

    -- Опубликованный документ обязан быть в перечне, иначе файл доступен
    -- по прямой ссылке, но нигде не показан.
    constraint document_published_is_listed check (not published or listed)
);

create index document_public_idx on document (listed, doc_group, title);
create index document_product_idx on document (product_slug);
