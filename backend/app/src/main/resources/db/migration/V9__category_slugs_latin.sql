-- Слаги категорий были записаны кириллицей: генератор V2 оставлял русские буквы.
-- В маршрутах они пока не используются, но уже отдаются публичным API, и как
-- только попадут в URL — превратятся в процент-кодирование и сломают ссылки
-- в письмах и мессенджерах. Переписываем на латиницу, пока цена нулевая.
--
-- Генератор backend/tools/seed-catalog.mjs исправлен вместе с этой миграцией:
-- транслитерация вынесена в backend/tools/slug.mjs, повторная генерация даст
-- те же значения.
update category set slug = 'neonatologiya'       where slug = 'неонатология';
update category set slug = 'reanimaciya'         where slug = 'реанимация';
update category set slug = 'anesteziologiya'     where slug = 'анестезиология';
update category set slug = 'monitoring'          where slug = 'мониторинг';
update category set slug = 'intensivnaya-terapiya' where slug = 'интенсивная-терапия';
