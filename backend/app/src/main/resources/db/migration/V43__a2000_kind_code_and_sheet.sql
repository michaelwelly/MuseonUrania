-- Customer update, 18 September 2026.
-- The kind code belongs directly below the monitoring channels in the
-- product card. The A-2000 PDF keeps its stable storage key so replacing
-- the object updates both the card download and Vedalina's source.

update product_spec s
set position = 4
from product p
where s.product_id = p.id
  and p.slug = 'vedal-a-2000'
  and s.kind = 'key_param'
  and s.label = 'Производство';

insert into product_spec (id, product_id, kind, position, label, value, muted)
select 'b31eb9fd-d54b-4e90-8f7d-f34dd0c35c2e', p.id, 'key_param', 3,
       'Код вида', '157920', false
from product p
where p.slug = 'vedal-a-2000'
  and not exists (
      select 1
      from product_spec s
      where s.product_id = p.id
        and s.kind = 'key_param'
        and s.label = 'Код вида'
  );

update product_spec s
set value = '157920',
    position = 3,
    muted = false
from product p
where s.product_id = p.id
  and p.slug = 'vedal-a-2000'
  and s.kind = 'key_param'
  and s.label = 'Код вида';

update document
set file_size = 2425593,
    revision = 'редакция заказчика от 18.09.2026',
    approved_by = 'ООО «ВЕДАЛ»',
    updated_at = now()
where slug = 'vedal-a-2000-product-sheet';
