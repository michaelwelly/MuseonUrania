-- 1. Переименование изделия больше не отбивается внешним ключом.
--
-- document.product_slug ссылается на product.slug. Без ON UPDATE CASCADE смена
-- slug'а у изделия, на которое ссылается хоть один документ, отбивалась базой
-- уже после всех проверок в коде — наружу уходила 500-я без разбора причины.
--
-- Каскад здесь честнее явной проверки в коде: документ ссылается на изделие,
-- и при переименовании изделия ссылка обязана поехать за ним. Проверка в коде
-- на её месте означала бы «нельзя переименовать, пока есть документы» —
-- запрет там, где нужно всего лишь согласованное обновление.
alter table document drop constraint document_product_slug_fkey;
alter table document add constraint document_product_slug_fkey
    foreign key (product_slug) references product (slug)
    on update cascade on delete set null;

-- 2. Версия строки: два редактора больше не затирают правки друг друга молча.
--
-- Форма админки отправляется целиком, включая полностью заменяемый список
-- характеристик. Без версии второй сохранивший возвращал содержимое к тому,
-- что было у него на экране, и оба видели успех — потеря обнаруживалась
-- только на сайте.
--
-- not null default 0: существующие строки получают нулевую версию, и первое
-- же сохранение поднимает её.
alter table product   add column version bigint not null default 0;
alter table news_item add column version bigint not null default 0;
alter table document  add column version bigint not null default 0;
