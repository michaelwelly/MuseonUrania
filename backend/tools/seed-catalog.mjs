// Одноразовый генератор миграции V2 из frontend/content/products.ts.
// Запуск из корня репозитория:
//   node backend/tools/seed-catalog.mjs > backend/app/src/main/resources/db/migration/V2__catalog_seed.sql
import { products, categories } from "../../frontend/content/products.ts";
import { randomUUID } from "node:crypto";
import { slugify } from "./slug.mjs";

const q = (v) => (v === undefined || v === null ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const out = [];
out.push("-- Сгенерировано backend/tools/seed-catalog.mjs из frontend/content/products.ts.");
out.push("-- Править руками бессмысленно: перегенерировать и закоммитить заново.");
out.push("");

const categoryId = new Map();
categories.forEach((name, i) => {
  const id = randomUUID();
  categoryId.set(name, id);
  out.push(`insert into category (id, slug, name, position) values ('${id}', ${q(slugify(name))}, ${q(name)}, ${i});`);
});
out.push("");

products.forEach((p, i) => {
  const id = randomUUID();
  out.push(
    `insert into product (id, slug, name, kind, summary, detail, doc_status, published, sort_order, image_src, image_alt) values ` +
      `('${id}', ${q(p.slug)}, ${q(p.name)}, ${q(p.kind)}, ${q(p.summary)}, ${q(p.detail)}, ${q(p.status)}, true, ${i}, ${q(p.image?.src)}, ${q(p.image?.alt)});`
  );
  for (const c of p.categories) {
    out.push(`insert into product_category (product_id, category_id) values ('${id}', '${categoryId.get(c)}');`);
  }
  const rows = [
    ...(p.keyParams ?? []).map((s, j) => ["key_param", j, s]),
    ...(p.specs ?? []).map((s, j) => ["spec", j, s]),
  ];
  for (const [kind, j, s] of rows) {
    out.push(
      `insert into product_spec (id, product_id, kind, position, label, value, muted) values ` +
        `('${randomUUID()}', '${id}', '${kind}', ${j}, ${q(s.label)}, ${q(s.value)}, ${s.muted ? "true" : "false"});`
    );
  }
  out.push("");
});

process.stdout.write(out.join("\n"));
