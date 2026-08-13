// Презентация статуса в PDF: outputs/vedal_portal_status_*.pdf
//
// Пересборка и проверка:
//   npm i pdfkit pdfjs-dist @napi-rs/canvas
//   node outputs/build-status-pdf.mjs outputs/vedal_portal_status_ГГГГ_ММ_ДД.pdf
//   node outputs/render-pdf.mjs outputs/vedal_portal_status_ГГГГ_ММ_ДД.pdf 1.4
//
// Второй скрипт раскладывает страницы в PNG — глазами смотреть нечем иначе,
// в среде нет ни LibreOffice, ни poppler. Шрифты лежат в outputs/fonts,
// это статические срезы Unbounded и Commissioner с Google Fonts (лицензия OFL).
// Презентация статуса VEDAL Portal в PDF.
//
// Шрифты сайта зашиты в файл: Unbounded на заголовках (его геометрия созвучна
// начертанию слова VEDAL в логотипе) и Commissioner в тексте. Поэтому PDF
// выглядит одинаково везде и не зависит от того, что стоит у смотрящего.
//
// Вместимость текста проверяется настоящими метриками через heightOfString:
// если абзац не влезает в отведённую высоту, сборка падает с указанием слайда.

import PDFDocument from "pdfkit";
import { createWriteStream } from "node:fs";

const GREEN = "#149c3c";
const GREEN_DARK = "#0f7c30";
const GREEN_ON_DARK = "#3fc46a";
const DEEP = "#08211d";
const DEEP_2 = "#0d3229";
const INK = "#12202a";
const TEXT_2 = "#3e4e55";
const MUTED = "#5e6b73";
const SOFT = "#f4f8f6";
const LINE = "#dde5e2";
const OK_BG = "#eaf6ee";
const PART_BG = "#f7f1e2";
const PART_FG = "#8a6212";
const WAIT_BG = "#eef2f0";
const ON_DARK = "#b6c7c0";
const WHITE = "#ffffff";
const MUTED_DARK = "#8ba39a"; // MUTED на тёмном фоне читается плохо

const W = 960;
const H = 540;
const M = 46;
const CW = W - M * 2;

const doc = new PDFDocument({ size: [W, H], margin: 0, autoFirstPage: false });
doc.registerFont("head", "fonts/unbounded-600.ttf");
doc.registerFont("headLight", "fonts/unbounded-400.ttf");
doc.registerFont("body", "fonts/commissioner-400.ttf");
doc.registerFont("bodyBold", "fonts/commissioner-600.ttf");

const problems = [];
let current = 0;

// ——— примитивы ———

function box(x, y, w, h, fill, stroke) {
  doc.roundedRect(x, y, w, h, 3);
  if (fill && stroke) doc.fillAndStroke(fill, stroke);
  else if (fill) doc.fill(fill);
  else doc.stroke(stroke);
}

/** Текст с проверкой, что он влез в отведённую высоту. */
function text(str, x, y, opts = {}) {
  const { font = "body", size = 13, color = TEXT_2, width = CW, height, lineGap = 3, align, characterSpacing } = opts;
  doc.font(font).fontSize(size).fillColor(color);
  const o = { width, lineGap, align, characterSpacing };
  if (height !== undefined) {
    const needed = doc.heightOfString(str, o);
    if (needed > height + 0.5) {
      problems.push(`слайд ${current}: «${str.slice(0, 38)}…» нужно ${needed.toFixed(1)}pt, отведено ${height}pt`);
    }
  }
  doc.text(str, x, y, o);
}

function chip(x, y, label, bg, fg) {
  const w = doc.font("bodyBold").fontSize(8.5).widthOfString(label) + 16;
  box(x - w, y, w, 17, bg);
  doc.font("bodyBold").fontSize(8.5).fillColor(fg).text(label, x - w, y + 4.5, { width: w, align: "center", characterSpacing: 0.4 });
  return w;
}


/** Стрелки рисуем фигурами: символов → и ↓ нет в наборе Commissioner,
 *  и вместо них в PDF попадает .notdef — пустой квадрат. */
function arrowRight(x, y, len, color) {
  doc.moveTo(x, y).lineTo(x + len - 5, y).lineWidth(1.3).stroke(color);
  doc.moveTo(x + len, y).lineTo(x + len - 6, y - 3.5).lineTo(x + len - 6, y + 3.5).fill(color);
}

function arrowDown(x, y, len, color) {
  doc.moveTo(x, y).lineTo(x, y + len - 5).lineWidth(1.3).stroke(color);
  doc.moveTo(x, y + len).lineTo(x - 3.5, y + len - 6).lineTo(x + 3.5, y + len - 6).fill(color);
}

function slide(dark = false) {
  doc.addPage();
  current++;
  if (dark) box(0, 0, W, H, DEEP);
  else box(0, 0, W, H, WHITE);
}

function header(eyebrow, title) {
  text(eyebrow.toUpperCase(), M, 38, { font: "bodyBold", size: 9, color: GREEN, characterSpacing: 1.5, height: 14 });
  text(title, M, 56, { font: "head", size: 25, color: INK, height: 34, lineGap: 0 });
}

// ——— 1. титул ———
slide(true);
text("VEDAL PORTAL · СОСТОЯНИЕ ПРОДУКТА", M, 110, { font: "bodyBold", size: 10, color: GREEN_ON_DARK, characterSpacing: 2, height: 16 });
text("Что построено\nи что делаем дальше", M, 140, { font: "head", size: 38, color: WHITE, lineGap: 8, width: 700, height: 120 });
text(
  "Сайт, CRM и закрытый контур — одна платформа, а не витрина отдельно и учёт отдельно. Серверная часть работает, сайт работает, они соединены между собой. Дальше — закрытый контур и переезд в облако.",
  M, 300, { size: 14, color: ON_DARK, width: 640, lineGap: 5, height: 80 },
);
doc.font("bodyBold").fontSize(11).fillColor(WHITE).text("13 августа 2026", M, 470, { continued: true });
doc.font("body").fillColor(MUTED_DARK).text("      ветка dev · fbb9313      тесты 64 / 64      22 страницы сайта");

// ——— 2. цифры ———
slide();
header("Состояние", "Из чего сегодня состоит продукт");
{
  const stats = [
    ["11", "модулей бэкенда"], ["64", "теста, все зелёные"], ["3", "двери наружу"],
    ["12", "позиций каталога"], ["22", "страницы сайта"], ["42", "документа ru + en"],
  ];
  const cw = (CW - 24 * 2) / 3;
  stats.forEach((s, i) => {
    const x = M + (i % 3) * (cw + 24);
    const y = 120 + Math.floor(i / 3) * 155;
    box(x, y, cw, 130, SOFT, LINE);
    text(s[0], x + 24, y + 24, { font: "head", size: 42, color: GREEN, width: cw - 48, height: 56, lineGap: 0 });
    text(s[1], x + 24, y + 88, { size: 12.5, color: MUTED, width: cw - 48, height: 20 });
  });
}

// ——— 3. два контура ———
slide();
header("Рамка", "Два контура и шлюз между ними");
text(
  "Стандартные сервисы не переписываем, уникальную логику держим у себя. Почта и календарь покупные. CRM, документы и правила доступа — свои, потому что именно они и есть продукт.",
  M, 100, { size: 12.5, color: TEXT_2, width: 800, height: 42 },
);
{
  const lanes = [
    ["Открытый офис", "покупаем", ["Почта, календарь, Телемост", "Яндекс Формы", "Диск без секретов", "Вики и трекер"], SOFT, INK],
    ["Сайт и шлюз", "пишем сами", ["Публичный сайт и каталог", "Формы заявок, Урания", "Backend API, админка", "Integration Gateway"], OK_BG, GREEN_DARK],
    ["Закрытый контур", "пишем сами", ["CRM: лиды, сделки, КП", "Document Vault, PostgreSQL", "Keycloak + MFA, роли", "Логи, аудит, бэкапы"], SOFT, INK],
  ];
  const lw = (CW - 34 * 2) / 3;
  lanes.forEach((l, i) => {
    const x = M + i * (lw + 34);
    box(x, 152, lw, 268, l[3], LINE);
    text(l[0], x + 22, 172, { font: "head", size: 15, color: l[4], width: lw - 44, height: 22, lineGap: 0 });
    text(l[1], x + 22, 196, { size: 11, color: MUTED, width: lw - 44, height: 16 });
    l[2].forEach((item, k) => {
      doc.circle(x + 26, 228 + k * 44, 2.5).fill(GREEN);
      text(item, x + 36, 221 + k * 44, { size: 12, color: TEXT_2, width: lw - 58, height: 36 });
    });
    if (i < 2) {
      arrowRight(x + lw + 9, 286, 16, i === 1 ? GREEN : MUTED);
    }
  });
  text(
    "Единственный путь внутрь — через шлюз. Клиентская база, договоры и персональные данные наружу не выходят: обратно уезжает только согласованный документ или шаблонное письмо.",
    M, 448, { size: 12, color: MUTED, width: 840, height: 42 },
  );
}

// ——— 4. три двери ———
slide();
header("Периметр", "Три двери, и четвёртой не будет");
text(
  "Новая функция приезжает в одну из трёх. Тогда периметр проверяется в трёх местах, а не в тридцати контроллерах.",
  M, 100, { size: 12.5, color: TEXT_2, width: 800, height: 20 },
);
{
  const doors = [
    ["/api/public/v1/**", "сборка сайта, Урания", "Только чтение, только опубликованное, кэшируется на пять минут"],
    ["/api/forms/v1/leads", "формы сайта, почта", "Единственная запись снаружи. Идемпотентность по ключу: повторный клик не создаёт вторую заявку"],
    ["/admin/**", "сотрудник", "Сессия и роли. Закрывается целиком на прокси, код от выбора не зависит"],
  ];
  doors.forEach((d, i) => {
    const y = 140 + i * 100;
    box(M, y, CW, 84, SOFT, LINE);
    text(d[0], M + 24, y + 18, { font: "bodyBold", size: 13.5, color: GREEN_DARK, width: 250, height: 20 });
    text(d[1], M + 24, y + 44, { size: 11.5, color: MUTED, width: 250, height: 18 });
    text(d[2], M + 300, y + 22, { size: 13, color: TEXT_2, width: CW - 330, height: 44 });
  });
}

// ——— 5. путь заявки ———
slide();
header("Механика", "Путь заявки — он же границы модулей");
{
  const steps = [
    ["Заявка", "сайт · форма · почта", SOFT, INK],
    ["gateway", "источник, поля, вложения", OK_BG, GREEN_DARK],
    ["crm", "черновик лида", OK_BG, GREEN_DARK],
    ["notifications", "шаблонное письмо", OK_BG, GREEN_DARK],
    ["Клиент", "получает ответ", SOFT, INK],
  ];
  const sw = 150;
  const gap = (CW - sw * 5) / 4;
  steps.forEach((s, i) => {
    const x = M + i * (sw + gap);
    box(x, 140, sw, 92, s[2], LINE);
    text(s[0], x + 16, 158, { font: "head", size: 13, color: s[3], width: sw - 32, height: 20, lineGap: 0 });
    text(s[1], x + 16, 184, { size: 10.5, color: MUTED, width: sw - 32, height: 34 });
    if (i < 4) arrowRight(x + sw + gap / 2 - 9, 186, 18, MUTED);
  });

  box(M + sw + gap, 300, sw * 3 + gap * 2, 62, WAIT_BG, LINE);
  text("audit · журнал только на добавление", M + sw + gap + 22, 322, { font: "bodyBold", size: 13, color: TEXT_2, width: 400, height: 20 });
  [1, 2, 3].forEach((i) => {
    const x = M + i * (sw + gap) + sw / 2;
    arrowDown(x, 236, 58, MUTED);
  });

  text(
    "Запись в базу и событие коммитятся одной транзакцией, поэтому заявка не теряется, даже если письмо не ушло. Правку журнала задним числом запрещает триггер базы, а не дисциплина.",
    M, 412, { size: 12.5, color: MUTED, width: 830, height: 44 },
  );
}

// ——— 6. готовые модули ———
slide();
header("Модули", "Семь готовы целиком");
text(
  "Одно приложение, одна база. Модули — границы пакетов ru.vedal.portal.*, а не отдельные деплои: пятьдесят сотрудников не требуют микросервисов.",
  M, 100, { size: 12.5, color: TEXT_2, width: 820, height: 42 },
);
{
  const mods = [
    ["catalog", "Продукция и категории, публичное API, правка и публикация в админке"],
    ["content", "Новости и пресс-центр. Пустая лента — нормальное состояние"],
    ["documents", "Перечень, статусы доступа, выдача файла за портом FileStorage"],
    ["gateway", "Приём заявок: проверка, honeypot, лимит частоты, идемпотентность"],
    ["audit", "Журнал только на добавление, правку запрещает триггер базы"],
    ["common", "Ошибки в одном формате, транзакционный outbox, лимиты"],
    ["app", "Сборка, четыре окружения, проверка переменных до старта, CORS"],
  ];
  const cw = (CW - 24) / 2;
  mods.forEach((m, i) => {
    const last = i === mods.length - 1;
    const x = M + (last ? 0 : (i % 2) * (cw + 24));
    const y = 148 + Math.floor(i / 2) * 66;
    const bw = last ? CW : cw;
    box(x, y, bw, 56, SOFT, LINE);
    text(m[0], x + 18, y + 10, { font: "bodyBold", size: 13, color: INK, width: 180, height: 20 });
    chip(x + bw - 14, y + 9, "ГОТОВ", OK_BG, GREEN_DARK);
    text(m[1], x + 18, y + 30, { size: 11, color: TEXT_2, width: bw - 36, height: 18 });
  });
}

// ——— 7. наполовину ———
slide();
header("Модули", "Четыре сделаны наполовину");
{
  const half = [
    ["crm", "Лиды принимаются и видны в админке.", "Нет сделок, КП, статусов и ответственного"],
    ["notifications", "Шаблоны, очередь и учёт доставки готовы.", "Письма уходят в лог: SMTP Яндекс 360 не подключён"],
    ["assistant", "Ограничения и передача человеку работают.", "За портом LlmEngine поиск по словам, модели нет"],
    ["iam", "Вход в админку на локальных учётках.", "Keycloak и MFA ждут согласования закрытого контура"],
  ];
  const cw = (CW - 24) / 2;
  half.forEach((m, i) => {
    const x = M + (i % 2) * (cw + 24);
    const y = 120 + Math.floor(i / 2) * 152;
    box(x, y, cw, 132, SOFT, LINE);
    text(m[0], x + 22, y + 18, { font: "bodyBold", size: 14, color: INK, width: 200, height: 20 });
    chip(x + cw - 18, y + 17, "НАПОЛОВИНУ", PART_BG, PART_FG);
    text(m[1], x + 22, y + 48, { size: 12.5, color: TEXT_2, width: cw - 44, height: 34 });
    text(m[2], x + 22, y + 88, { font: "bodyBold", size: 12.5, color: PART_FG, width: cw - 44, height: 34 });
  });
  text(
    "Плюс knowledge и vlm — AI-поиск по внутренним документам и визуальные модели для сервиса. Не начаты, это отдельные этапы роадмапа.",
    M, 440, { size: 12, color: MUTED, width: 830, height: 34 },
  );
}

// ——— 8. соединили ———
slide();
header("Сделано на этой неделе", "Сайт и бэкенд соединены");
text(
  "До этого обе половины были написаны по одной спеке, но между ними не было ни одного провода: формы никуда не отправлялись, Урания отвечала заготовками, каталог жил в файле фронтенда.",
  M, 100, { size: 12.5, color: TEXT_2, width: 840, height: 42 },
);
{
  const items = [
    ["Чтение — на сборке", "Каталог, новости и документы приходят из публичного API и обновляются раз в пять минут. Падение бэкенда не роняет уже собранный сайт.", false],
    ["Запись — из браузера", "Формы уходят с ключом идемпотентности, Урания спрашивает Assistant API и показывает ссылки на источники.", false],
    ["Нет источников — нет ответа", "Ассистент не придумывает. Когда подходящих опубликованных материалов нет, идёт передача человеку с контактами.", false],
    ["Фотографии — из MinIO", "Медиа переехали в объектное хранилище. Локально MinIO, в облаке Yandex Object Storage: оба говорят на S3.", true],
  ];
  const cw = (CW - 24) / 2;
  items.forEach((it, i) => {
    const x = M + (i % 2) * (cw + 24);
    const y = 150 + Math.floor(i / 2) * 148;
    box(x, y, cw, 128, it[2] ? OK_BG : SOFT, LINE);
    text(it[0], x + 22, y + 18, { font: "head", size: 14, color: it[2] ? GREEN_DARK : INK, width: cw - 44, height: 22, lineGap: 0 });
    text(it[1], x + 22, y + 48, { size: 12.5, color: TEXT_2, width: cw - 44, height: 68 });
  });
}

// ——— 9-10. план ———
function planSlide(from, rows, note) {
  slide();
  header("План", "Что делаем дальше");
  rows.forEach((r, i) => {
    const y = 112 + i * (rows.length === 4 ? 88 : 105);
    text(String(from + i).padStart(2, "0"), M, y, { font: "headLight", size: 26, color: GREEN, width: 50, height: 34, lineGap: 0 });
    text(r[0], M + 62, y + 2, { font: "head", size: 15, color: INK, width: 560, height: 22, lineGap: 0 });
    text(r[1], M + 62, y + 28, { size: 12, color: TEXT_2, width: 690, height: 48 });
    chip(W - M, y + 2, r[2], r[3] === "ok" ? OK_BG : PART_BG, r[3] === "ok" ? GREEN_DARK : PART_FG);
  });
  if (note) text(note, M, 470, { size: 12, color: MUTED, width: 840, height: 32 });
}

planSlide(1, [
  ["Потребители событий переезжают в Kafka", "Публикация из outbox готова, топики заводит приложение. Осталось заставить потребителей читать из топиков, а не из процесса, и добавить очередь разбора для битых событий.", "БЭКЕНД", "ok"],
  ["Keycloak и MFA вместо локальных учёток", "Вход строится на покупном провайдере идентичности, у нас остаётся модель ролей. Это условие для всего закрытого контура.", "БЭКЕНД", "ok"],
  ["Документы в объектное хранилище", "MinIO уже поднят и медиа в нём. Осталось перевести туда документы: клиент на AWS SDK, приватный бакет, подписанные ссылки.", "БЭКЕНД", "ok"],
  ["CRM целиком", "Клиенты, сделки, КП, статусы, ответственный, дилерская и сервисная воронки, аналитика по изделию и источнику.", "БЭКЕНД", "ok"],
], "Порядок не произвольный: каждый шаг оставляет работающее приложение.");

planSlide(5, [
  ["Живые письма и живая модель", "Почта переключается на SMTP Яндекс 360. Урания получает YandexGPT и pgvector. Ограничения остаются в коде до вызова модели, а не в промпте.", "БЭКЕНД", "ok"],
  ["Пресс-центр, партнёры, SEO и аналитика", "Двух страниц из карты сайта ещё нет. Плюс метаданные, разметка изделий, Яндекс Метрика и десять именованных событий — список уже согласован.", "ФРОНТЕНД", "ok"],
  ["Переезд в облако", "VM, Managed PostgreSQL и Kafka, объектное хранилище, бэкапы с проверкой восстановления, мониторинг, сборка с деплоем.", "ИНФРА", "part"],
], "Последний шаг упирается в Yandex Cloud, которого пока нет: до него бэкенд живёт локально, а сайт остаётся статикой.");

// ——— 11. онбординг ———
slide();
header("Онбординг", "Как включиться");
{
  const half = (CW - 36) / 2;
  text("Поднять у себя", M, 108, { font: "head", size: 15, color: INK, width: half, height: 22, lineGap: 0 });
  box(M, 136, half, 190, DEEP_2);
  const cmds = [
    ["# база, брокер и хранилище", MUTED],
    ["docker compose -f backend/compose.yaml up -d", "#d6e4de"],
    ["", null],
    ["# фотографии в хранилище", MUTED],
    ["node backend/tools/upload-media.mjs", "#d6e4de"],
    ["", null],
    ["# бэкенд 8081, сайт 3000", MUTED],
    ["cd backend && ./mvnw spring-boot:run", "#d6e4de"],
    ["cd frontend && npm run dev", "#d6e4de"],
  ];
  cmds.forEach((c, i) => {
    if (!c[0]) return;
    text(c[0], M + 20, 154 + i * 19, { size: 10.5, color: c[1], width: half - 40, height: 16, font: c[1] === MUTED ? "body" : "bodyBold" });
  });
  text(
    "Нужны JDK 25, Node 24 и Docker. Тесты идут на настоящем PostgreSQL, поэтому Docker обязателен именно для них. Настройки сайта — frontend/.env.example.",
    M, 340, { size: 12, color: TEXT_2, width: half, height: 56 },
  );

  const rx = M + half + 36;
  text("Куда коммитить", rx, 108, { font: "head", size: 15, color: INK, width: half, height: 22, lineGap: 0 });
  const branches = [
    ["back", "серверная логика, тесты бэкенда"], ["front", "клиент, стили, тесты фронтенда"],
    ["db", "миграции, SQL, seed-данные"], ["infra", "сборка, CI/CD, Docker, зависимости"],
    ["docs", "документация и спеки"], ["dev", "интеграция, всё тестируется вместе"],
    ["main", "только протестированное"],
  ];
  branches.forEach((b, i) => {
    const y = 140 + i * 27;
    text(b[0], rx, y, { font: "bodyBold", size: 12, color: GREEN_DARK, width: 60, height: 18 });
    text(b[1], rx + 64, y, { size: 12, color: TEXT_2, width: half - 64, height: 18 });
  });
  text(
    "Коммиты — Conventional Commits с префиксом слоя. Мерж в dev с флагом --no-ff. В main — только после зелёных тестов.",
    rx, 340, { size: 12, color: TEXT_2, width: half, height: 56 },
  );

  text(
    "Начинать читать — с docs/PROJECT.md. Там суть, архитектура, раскладка репозитория и открытые вопросы; остальные сорок документов — детализация. Документация ведётся парами ru и en с переключателем внутри файла.",
    M, 420, { size: 12, color: MUTED, width: CW, height: 40 },
  );
}

// ——— 12. риски ———
slide(true);
text("ЧТО МЕШАЕТ", M, 44, { font: "bodyBold", size: 9, color: GREEN_ON_DARK, characterSpacing: 1.5, height: 14 });
text("Риски и чего ждём", M, 62, { font: "head", size: 25, color: WHITE, height: 34, lineGap: 0 });
{
  const risks = [
    ["Расхождения в документах", "Пять штук, каждое зафиксировано как нерешённое: 50 или 60 сотрудников, Kafka или Redis, своя CRM или коробочная, «около десяти» или тринадцать изделий."],
    ["Данных по продукции нет", "Датащитами подтверждены три позиции из двенадцати. Статус регистрации не подтверждён ни у одной, фотографий отдельными файлами нет."],
    ["Облака нет", "Всё, что упирается в Yandex Cloud, стоит: Managed PostgreSQL и Kafka, бэкапы, мониторинг, развёртывание. Бэкенд пока живёт локально."],
    ["Ждут подтверждения", "Допустимая потеря данных и время подъёма, срок хранения заявок, закрывать ли админку по сети, когда подключаем Keycloak."],
  ];
  const cw = (CW - 30) / 2;
  risks.forEach((r, i) => {
    const x = M + (i % 2) * (cw + 30);
    const y = 128 + Math.floor(i / 2) * 148;
    box(x, y, cw, 128, DEEP_2, "#1e3a34");
    text(r[0], x + 22, y + 18, { font: "head", size: 14, color: GREEN_ON_DARK, width: cw - 44, height: 22, lineGap: 0 });
    text(r[1], x + 22, y + 48, { size: 12, color: ON_DARK, width: cw - 44, height: 68 });
  });
  text(
    "Источник истины — docs/PROJECT.md в репозитории. Эта презентация — срез на 13 августа 2026; если расходится с репозиторием, прав репозиторий.",
    M, 470, { size: 11.5, color: MUTED_DARK, width: CW, height: 30 },
  );
}

const out = process.argv[2] ?? "vedal-portal-status.pdf";
const stream = createWriteStream(out);
doc.pipe(stream);
doc.end();
stream.on("finish", () => {
  if (problems.length) {
    console.error("не помещается:");
    problems.forEach((p) => console.error("  " + p));
    process.exit(1);
  }
  console.log(`готово: ${out}, страниц: ${current}, текст везде помещается`);
});
