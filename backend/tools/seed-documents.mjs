// Одноразовый генератор миграции V11 из frontend/content/documents.ts.
// Запуск из корня репозитория:
//   node backend/tools/seed-documents.mjs > backend/src/main/resources/db/migration/V11__document_seed.sql
import { documents } from "../../frontend/content/documents.ts";
import { products } from "../../frontend/content/products.ts";
import { randomUUID } from "node:crypto";
import { slugify } from "./slug.mjs";

const q = (v) => (v === undefined || v === null ? "null" : `'${String(v).replace(/'/g, "''")}'`);

// «PDF» / «По запросу» / «Уточняется» из documents.ts → значения схемы.
const ACCESS = { PDF: "pdf", "По запросу": "on_request", Уточняется: "pending" };

// В documents.ts поле product — человекочитаемое: «VEDAL R1, R2», «Все изделия»,
// «Производство», «ООО «ВЕДАЛ»». Слаг ставим только когда это конкретное изделие
// из каталога, иначе оставляем null: связь с несуществующим изделием отвалится
// на внешнем ключе.
const bySlug = new Map(products.map((p) => [p.name, p.slug]));

const out = [];
out.push("-- Сгенерировано backend/tools/seed-documents.mjs из frontend/content/documents.ts.");
out.push("-- Править руками бессмысленно: перегенерировать и закоммитить заново.");
out.push("--");
out.push("-- listed = true, published = false у всех: перечень документов на сайте");
out.push("-- показывается вместе со статусом доступа, но ни один файл ещё не");
out.push("-- согласован к публикации и не загружен.");
out.push("");

// Заголовки повторяются: «Регистрационное удостоверение» у трёх изделий,
// «Описание изделия» тоже. Считаем заранее и добираем уникальность предметом
// у всех повторяющихся, а не только у второго и далее: иначе один документ
// из тройки получает короткий слаг, а два — длинный, и публичные адреса
// выглядят как случайность.
const titleCount = documents.reduce((acc, d) => acc.set(d.title, (acc.get(d.title) ?? 0) + 1), new Map());

for (const d of documents) {
  const product = bySlug.get(d.product) ?? null;

  const base = slugify(d.title);
  const slug = titleCount.get(d.title) > 1 ? `${base}-${slugify(d.product)}` : base;

  out.push(
    "insert into document (id, slug, title, doc_group, subject, product_slug, sensitivity, access, listed, published) values " +
      `('${randomUUID()}', ${q(slug)}, ${q(d.title)}, ${q(d.group)}, ${q(d.product)}, ${q(product)}, 'public', ${q(ACCESS[d.access])}, true, false);`
  );
}

process.stdout.write(out.join("\n") + "\n");
