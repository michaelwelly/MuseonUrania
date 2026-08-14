// Генератор коллекции Postman из выгрузки OpenAPI.
// Запуск из корня репозитория:
//   node backend/tools/postman-collection.mjs > docs/api/vedal.postman_collection.json
//
// Коллекция собирается, а не пишется руками, по той же причине, по которой
// генерируется миграция V2: набитая вручную, она разошлась бы с дверями
// на первой же правке контракта и врала бы тому, кто по ней тыкает.
//
// Источник — docs/api/*.json, то есть те же файлы, что springdoc отдаёт
// по /v3/api-docs. Порядок такой: правка контроллера → пересборка портала →
// обновление выгрузки → перегенерация коллекции.

import { readFileSync } from "node:fs";

const ROOT = process.cwd();

const specs = [
  { file: `${ROOT}/docs/api/vedal-openapi.json`, group: "Публичное API", auth: false },
  { file: `${ROOT}/docs/api/vedal-admin-openapi.json`, group: "Админское API", auth: true },
];

// Идентификатор в пути подставляется переменной, а не образцом: запросы
// в папке идут цепочкой, и следующий должен видеть то, что создал предыдущий.
const PATH_VARS = {
  leads: "leadId", clients: "clientId", deals: "dealId", quotes: "quoteId",
  products: "productId", news: "newsId", documents: "documentId",
  categories: "categoryId", attachments: "documentId",
};

// Что запрос кладёт в переменные коллекции после успешного ответа.
const CAPTURE = {
  "POST /api/forms/v1/leads": { leadId: "id" },
  "POST /api/admin/v1/leads/{id}/convert": { dealId: "id", clientId: "clientId" },
  "POST /api/admin/v1/clients": { clientId: "id" },
  "POST /api/admin/v1/deals": { dealId: "id" },
  "POST /api/admin/v1/quotes": { quoteId: "id", quoteVersion: "version" },
  "POST /api/admin/v1/products": { productId: "id" },
  "POST /api/admin/v1/news": { newsId: "id" },
};

let uid = 0;
const id = () => `vedal-${(uid++).toString().padStart(4, "0")}`;

// Идентификатор в теле — это ссылка на то, что создал предыдущий запрос
// в папке. Образец с нулевым UUID заставил бы вставлять его руками.
const BODY_VARS = new Set(["dealId", "clientId", "leadId", "quoteId", "documentId", "productId"]);

function example(schema, spec, depth = 0, name = null) {
  if (!schema || depth > 6) return null;
  if (schema.$ref) {
    const ref = schema.$ref.split("/").pop();
    return example(spec.components?.schemas?.[ref], spec, depth + 1, name);
  }
  if (name && BODY_VARS.has(name) && schema.format === "uuid") return `{{${name}}}`;
  if (schema.example !== undefined) return schema.example;
  if (schema.enum) return schema.enum[0];

  switch (schema.type) {
    case "object": {
      const out = {};
      for (const [key, value] of Object.entries(schema.properties ?? {})) {
        out[key] = example(value, spec, depth + 1, key);
      }
      return out;
    }
    case "array":
      return [example(schema.items, spec, depth + 1, name)].filter((v) => v !== null);
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return true;
    case "string":
      if (schema.format === "uuid") return "00000000-0000-0000-0000-000000000000";
      if (schema.format === "date") return "2026-12-31";
      if (schema.format === "date-time") return "2026-08-14T12:00:00Z";
      return "";
    default:
      return null;
  }
}

function url(path, operation) {
  const segments = path.split("/").filter(Boolean).map((segment, index, all) => {
    if (!segment.startsWith("{")) return segment;
    const raw = segment.slice(1, -1);
    if (raw === "slug") return "{{slug}}";
    const owner = all[index - 1];
    return `{{${PATH_VARS[owner] ?? PATH_VARS[raw] ?? raw}}}`;
  });

  const query = (operation.parameters ?? [])
    .filter((p) => p.in === "query")
    .map((p) => ({
      key: p.name,
      value: p.schema?.default != null ? String(p.schema.default) : "",
      description: p.description,
      // Необязательные приезжают выключенными: включать лишнее руками
      // проще, чем гадать, почему выборка пустая.
      disabled: !p.required && p.schema?.default == null,
    }));

  return {
    raw: `{{gateway}}/${segments.join("/")}` + (query.length ? "?" + query.filter((q) => !q.disabled).map((q) => `${q.key}=${q.value}`).join("&") : ""),
    host: ["{{gateway}}"],
    path: segments,
    query,
  };
}

function tests(method, path) {
  const capture = CAPTURE[`${method.toUpperCase()} ${path}`];
  if (!capture) return undefined;

  const lines = [
    "// Идентификатор уезжает в переменную коллекции: следующий запрос",
    "// в папке работает с тем, что создал этот.",
    "if (pm.response.code < 300) {",
    "    const body = pm.response.json();",
    ...Object.entries(capture).map(([variable, field]) =>
      `    if (body.${field} !== undefined) pm.collectionVariables.set("${variable}", body.${field});`),
    "}",
  ];
  return [{ listen: "test", script: { id: id(), type: "text/javascript", exec: lines } }];
}

const folders = new Map();

for (const { file, group, auth } of specs) {
  const spec = JSON.parse(readFileSync(file, "utf8"));

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!["get", "post", "put", "delete", "patch"].includes(method)) continue;

      const tag = operation.tags?.[0] ?? group;
      if (!folders.has(tag)) folders.set(tag, { name: tag, item: [], auth });

      const header = [];
      const body = operation.requestBody?.content;
      const json = body?.["application/json"]?.schema;
      const multipart = body?.["multipart/form-data"];

      let requestBody;
      if (json) {
        header.push({ key: "Content-Type", value: "application/json" });
        requestBody = {
          mode: "raw",
          raw: JSON.stringify(example(json, spec), null, 2),
          options: { raw: { language: "json" } },
        };
      } else if (multipart) {
        requestBody = {
          mode: "formdata",
          formdata: Object.keys(multipart.schema?.properties ?? { file: {} })
            .map((key) => ({ key, type: "file", src: [] })),
        };
      }

      // Ключ идемпотентности — не украшение: без него повторное нажатие
      // «Send» заводит вторую заявку.
      if (path === "/api/forms/v1/leads" && method === "post") {
        header.push({ key: "Idempotency-Key", value: "{{$guid}}" });
      }

      folders.get(tag).item.push({
        name: operation.summary ?? `${method.toUpperCase()} ${path}`,
        id: id(),
        event: tests(method, path),
        request: {
          method: method.toUpperCase(),
          header,
          body: requestBody,
          url: url(path, operation),
          description: [operation.description, operation.summary].filter(Boolean).join("\n\n"),
        },
        response: [],
      });
    }
  }
}

// Порядок папок: сначала то, с чего начинают.
const ORDER = [
  "Каталог", "Новости", "Документы", "Формы", "Ассистент",
  "Админка: сессия", "Админка: заявки", "Админка: клиенты", "Админка: сделки",
  "Админка: коммерческие предложения", "Админка: аналитика CRM",
  "Админка: каталог", "Админка: новости", "Админка: документы",
  "Админка: изображения", "Админка: журнал",
];
const sorted = [...folders.values()].sort(
  (a, b) => (ORDER.indexOf(a.name) + 1 || 99) - (ORDER.indexOf(b.name) + 1 || 99));

const token = [
  "// Токен берётся сам и обновляется, когда протух. Вручную его вставлять",
  "// не нужно: он живёт пятнадцать минут, и на середине разбора сделки",
  "// это ровно то, что отвлекает.",
  "//",
  "// Публичные двери токена не требуют — у их папок стоит noauth,",
  "// но лишний заголовок им и не мешает.",
  "const expiresAt = Number(pm.collectionVariables.get('tokenExpiresAt') || 0);",
  "if (pm.collectionVariables.get('token') && Date.now() < expiresAt - 30000) return;",
  "",
  "pm.sendRequest({",
  "    url: pm.collectionVariables.get('keycloak') + '/realms/vedal/protocol/openid-connect/token',",
  "    method: 'POST',",
  "    header: { 'Content-Type': 'application/x-www-form-urlencoded' },",
  "    body: { mode: 'urlencoded', urlencoded: [",
  "        { key: 'grant_type', value: 'password' },",
  "        { key: 'client_id', value: 'vedal-admin-ui' },",
  "        { key: 'username', value: pm.collectionVariables.get('username') },",
  "        { key: 'password', value: pm.collectionVariables.get('password') }",
  "    ]}",
  "}, (error, response) => {",
  "    if (error || response.code !== 200) {",
  "        console.error('Keycloak не выдал токен:', error || response.text());",
  "        return;",
  "    }",
  "    const body = response.json();",
  "    pm.collectionVariables.set('token', body.access_token);",
  "    pm.collectionVariables.set('tokenExpiresAt', Date.now() + body.expires_in * 1000);",
  "});",
];

const collection = {
  info: {
    _postman_id: "7b1f2c40-9a3e-4d51-8c66-vedalportal01",
    name: "VEDAL Portal",
    description: [
      "Все двери портала: публичное чтение, приём заявок, ассистент и админское API вместе с CRM.",
      "",
      "Собрано из docs/api/*.json — тех же файлов, что springdoc отдаёт по /v3/api-docs.",
      "Править руками бессмысленно: контракт меняется в backend/src/main/java, после чего",
      "коллекция пересобирается.",
      "",
      "**Токен вставлять не надо.** Скрипт коллекции берёт его в Keycloak по username/password",
      "из переменных и обновляет, когда протух.",
      "",
      "**Идентификаторы передаются между запросами.** «Отправить заявку» кладёт leadId,",
      "«Разобрать заявку в сделку» — dealId и clientId, «Завести КП» — quoteId. Поэтому",
      "папки работают по порядку сверху вниз.",
      "",
      "Адрес по умолчанию — шлюз на 8080. Портал напрямую — 8081, но тогда включится CORS,",
      "которого через шлюз нет.",
    ].join("\n"),
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] },
  event: [{ listen: "prerequest", script: { id: id(), type: "text/javascript", exec: token } }],
  variable: [
    { key: "gateway", value: "http://localhost:8080", type: "string" },
    { key: "keycloak", value: "http://localhost:8180", type: "string" },
    { key: "username", value: "editor", type: "string" },
    { key: "password", value: "editor-local", type: "string" },
    { key: "token", value: "", type: "string" },
    { key: "tokenExpiresAt", value: "0", type: "string" },
    { key: "slug", value: "vedal-r1-r2", type: "string" },
    { key: "leadId", value: "", type: "string" },
    { key: "clientId", value: "", type: "string" },
    { key: "dealId", value: "", type: "string" },
    { key: "quoteId", value: "", type: "string" },
    { key: "quoteVersion", value: "0", type: "string" },
    { key: "productId", value: "", type: "string" },
    { key: "newsId", value: "", type: "string" },
    { key: "documentId", value: "", type: "string" },
    { key: "categoryId", value: "", type: "string" },
  ],
  item: sorted.map((folder) => ({
    name: folder.name,
    item: folder.item,
    ...(folder.auth ? {} : { auth: { type: "noauth" } }),
  })),
};

process.stdout.write(JSON.stringify(collection, null, 2) + "\n");

// Сводка идёт в stderr: stdout — это сам файл, и любая строка в нём
// сломала бы JSON.
const total = sorted.reduce((n, f) => n + f.item.length, 0);
process.stderr.write(`папок ${sorted.length}, запросов ${total}\n`);
