-- Public product cards must agree with the approved R1 and R2 sheets.
-- Scales, pulse oximetry and the listed extension blocks are optional.

update product
set summary = 'Открытая реанимационная система: круговой доступ к ребёнку, лучистый обогрев в ручном или сервоконтролируемом режиме; весы и пульсоксиметрия доступны как опции.',
    updated_at = now()
where slug = 'vedal-r1';

update product
set summary = 'Открытая реанимационная система с ЖК-дисплеем и ящиком для принадлежностей; весы, пульсоксиметрия, фототерапия, аспиратор и респираторная поддержка доступны как опции.',
    updated_at = now()
where slug = 'vedal-r2';

update product_spec s
set value = 'Весы и пульсоксиметрия — опции'
from product p
where s.product_id = p.id
  and p.slug in ('vedal-r1', 'vedal-r2')
  and s.kind = 'key_param'
  and s.label = 'Мониторинг';

update product_spec s
set value = case s.label
    when 'Весы' then '200–8000 г, погрешность ±10 г (опция)'
    when 'Пульсоксиметрия' then 'SpO₂ 1–100 %, ЧСС 25–240 уд/мин (опция)'
    when 'Дисплей и управление' then 'ЖК-дисплей, ящик; отключение звука взмахом руки — опция'
    else s.value
end
from product p
where s.product_id = p.id
  and p.slug in ('vedal-r1', 'vedal-r2')
  and s.label in ('Весы', 'Пульсоксиметрия', 'Дисплей и управление');
