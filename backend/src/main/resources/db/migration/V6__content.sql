-- Новости и пресс-центр. Сида нет намеренно: frontend/content/news.ts пуст,
-- материалы Иннопрома числятся в «Awaiting NN», а демо-публикации из макета
-- в прод не переносим — прямое указание HANDOFF.md. Таблица нужна, чтобы
-- первую запись можно было добавить через админку, а не правкой кода.
create table news_item (
    id           uuid primary key,
    slug         text not null unique,
    tag          text not null check (tag in ('Продукция', 'Производство', 'Выставки', 'Сервис', 'Документы')),
    title        text not null,
    excerpt      text not null,
    body         text,

    -- published управляет видимостью, published_on — дата в ленте.
    -- Это разные вещи: материал готовят заранее и публикуют позже.
    published    boolean not null default false,
    published_on date,

    image_src    text,
    image_alt    text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    -- Опубликованной записи без даты в ленте быть не может: сортировка
    -- и вывод на сайте опираются на published_on.
    constraint news_published_needs_date check (not published or published_on is not null)
);

create index news_public_idx on news_item (published, published_on desc);
