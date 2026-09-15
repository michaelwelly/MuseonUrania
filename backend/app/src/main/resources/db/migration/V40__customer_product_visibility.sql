-- Customer review, 15 September 2026.
-- T-100 stays in the portal and can be published again from the admin area.
update product
set published = false,
    updated_at = now()
where slug = 'vedal-t-100';

update product
set summary = 'Совмещает инкубатор закрытого типа и открытую реанимационную систему. Переход между режимами электромеханическими приводами, без перекладывания новорождённого. Каналы мониторинга доступны как опции: пульсоксиметрия, ЭКГ, дыхание, НИАД, капнометрия.',
    updated_at = now()
where slug = 'vedal-a-2000';

update product_spec s
set value = 'Пульсоксиметрия, ЭКГ, дыхание, НИАД, капнометрия — опции'
from product p
where s.product_id = p.id
  and p.slug = 'vedal-a-2000'
  and s.kind = 'key_param'
  and s.label = 'Каналы мониторинга';
