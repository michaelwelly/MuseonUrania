// Генератор презентации статуса: outputs/vedal_portal_status_*.pptx
//
// Пересборка, когда цифры поедут:
//   npm i pptxgenjs jszip           (в репозиторий не тянем, нужны только здесь)
//   node outputs/build-status-deck.mjs outputs/vedal_portal_status_ГГГГ_ММ_ДД.pptx
//   node outputs/audit-deck.mjs outputs/vedal_portal_status_ГГГГ_ММ_ДД.pptx
//
// Аудит разбирает готовый пакет и ловит выход за край слайда, тесные поля
// и переполнение текстом — рендера в этой среде нет, поэтому проверка
// геометрическая. Цифры в слайдах — из docs/PROJECT.md, там же правило:
// их считают по репозиторию, а не переписывают по памяти.
// Сборка презентации статуса VEDAL Portal.
// Палитра — токены сайта: зелёный снят с логотипа и не меняется.

import pptxgen from "pptxgenjs";

const GREEN = "149C3C";
const GREEN_DARK = "0F7C30";
const GREEN_ON_DARK = "3FC46A";
const DEEP = "08211D";
const DEEP_2 = "0D3229";
const INK = "12202A";
const TEXT_2 = "3E4E55";
const MUTED = "5E6B73";
const SOFT = "F4F8F6";
const LINE = "DDE5E2";
const OK_BG = "EAF6EE";
const PART_BG = "F7F1E2";
const PART_FG = "8A6212";
const WAIT_BG = "EEF2F0";
const ON_DARK = "B6C7C0";

const HEAD = "Arial";
const BODY = "Calibri";
const MONO = "Courier New";

const W = 13.33;
const M = 0.62;
const CW = W - M * 2;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "VEDAL Portal";
pres.title = "VEDAL Portal — что построено и что дальше";

// ——— помощники ———

const card = (s, x, y, w, h, fill = SOFT) =>
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.05,
    fill: { color: fill },
    line: { color: LINE, width: 0.75 },
  });

function chip(s, x, y, text, bg, fg) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w: 1.28, h: 0.28, rectRadius: 0.04,
    fill: { color: bg }, line: { color: bg, width: 0 },
  });
  s.addText(text, {
    x, y, w: 1.28, h: 0.28, margin: 0,
    align: "center", valign: "middle",
    fontFace: BODY, fontSize: 10.5, bold: true, color: fg,
  });
}

function slideTitle(s, eyebrow, title) {
  s.addText(eyebrow.toUpperCase(), {
    x: M, y: 0.52, w: CW, h: 0.26, margin: 0,
    fontFace: BODY, fontSize: 11.5, bold: true, color: GREEN, charSpacing: 1.6,
  });
  s.addText(title, {
    x: M, y: 0.8, w: CW, h: 0.58, margin: 0,
    fontFace: HEAD, fontSize: 30, bold: true, color: INK,
  });
}

function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: DEEP };
  return s;
}

// ——— 1. титул ———
{
  const s = darkSlide();
  s.addText("VEDAL PORTAL · СОСТОЯНИЕ ПРОДУКТА", {
    x: M, y: 1.5, w: CW, h: 0.3, margin: 0,
    fontFace: BODY, fontSize: 13, bold: true, color: GREEN_ON_DARK, charSpacing: 2,
  });
  s.addText("Что построено\nи что делаем дальше", {
    x: M, y: 1.95, w: 9.4, h: 1.9, margin: 0,
    fontFace: HEAD, fontSize: 42, bold: true, color: "FFFFFF", lineSpacing: 46,
  });
  s.addText(
    "Сайт, CRM и закрытый контур — одна платформа, а не витрина отдельно и учёт отдельно. Серверная часть работает, сайт работает, они соединены между собой. Дальше — закрытый контур и переезд в облако.",
    { x: M, y: 4.05, w: 9.4, h: 1.1, margin: 0, fontFace: BODY, fontSize: 15.5, color: ON_DARK, lineSpacing: 23 },
  );
  s.addText(
    [
      { text: "13 августа 2026", options: { color: "FFFFFF", bold: true } },
      { text: "     ветка dev · 910bcd6     тесты 64 / 64     22 страницы сайта", options: { color: MUTED } },
    ],
    { x: M, y: 6.3, w: CW, h: 0.35, margin: 0, fontFace: BODY, fontSize: 12.5 },
  );
  s.addNotes("Срез на 13 августа 2026. Источник истины — docs/PROJECT.md в репозитории.");
}

// ——— 2. цифры ———
{
  const s = pres.addSlide();
  slideTitle(s, "Состояние", "Из чего сегодня состоит продукт");

  const stats = [
    ["11", "модулей бэкенда"],
    ["64", "теста, все зелёные"],
    ["3", "двери наружу"],
    ["12", "позиций каталога"],
    ["22", "страницы сайта"],
    ["42", "документа ru + en"],
  ];
  const cw = (CW - 0.4 * 2) / 3;
  stats.forEach((st, i) => {
    const x = M + (i % 3) * (cw + 0.4);
    const y = 1.75 + Math.floor(i / 3) * 2.25;
    card(s, x, y, cw, 1.85);
    s.addText(st[0], {
      x: x + 0.35, y: y + 0.28, w: cw - 0.7, h: 0.9, margin: 0,
      fontFace: HEAD, fontSize: 46, bold: true, color: GREEN,
    });
    s.addText(st[1], {
      x: x + 0.35, y: y + 1.2, w: cw - 0.7, h: 0.4, margin: 0,
      fontFace: BODY, fontSize: 14, color: MUTED,
    });
  });
  s.addNotes("Цифры получены подсчётом по репозиторию, а не переписаны по памяти.");
}

// ——— 3. два контура ———
{
  const s = pres.addSlide();
  slideTitle(s, "Рамка", "Два контура и шлюз между ними");
  s.addText(
    "Стандартные сервисы не переписываем, уникальную логику держим у себя. Почта и календарь покупные. CRM, документы и правила доступа — свои, потому что именно они и есть продукт.",
    { x: M, y: 1.42, w: 11.2, h: 0.5, margin: 0, fontFace: BODY, fontSize: 14, color: TEXT_2 },
  );

  const lanes = [
    ["Открытый офис", "покупаем", ["Почта, календарь, Телемост", "Яндекс Формы", "Диск без секретов", "Вики и трекер"], SOFT, INK],
    ["Сайт и шлюз", "пишем сами", ["Публичный сайт и каталог", "Формы заявок, Урания", "Backend API, админка", "Integration Gateway"], OK_BG, GREEN_DARK],
    ["Закрытый контур", "пишем сами", ["CRM: лиды, сделки, КП", "Document Vault, PostgreSQL", "Keycloak + MFA, роли", "Логи, аудит, бэкапы"], SOFT, INK],
  ];
  const lw = (CW - 0.5 * 2) / 3;
  lanes.forEach((lane, i) => {
    const x = M + i * (lw + 0.5);
    card(s, x, 2.15, lw, 3.65, lane[3]);
    s.addText(lane[0], {
      x: x + 0.3, y: 2.4, w: lw - 0.6, h: 0.34, margin: 0,
      fontFace: HEAD, fontSize: 17, bold: true, color: lane[4],
    });
    s.addText(lane[1], {
      x: x + 0.3, y: 2.74, w: lw - 0.6, h: 0.28, margin: 0,
      fontFace: BODY, fontSize: 12, italic: true, color: MUTED,
    });
    s.addText(
      lane[2].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < lane[2].length - 1 } })),
      { x: x + 0.3, y: 3.15, w: lw - 0.55, h: 2.4, margin: 0, fontFace: BODY, fontSize: 13.5, color: TEXT_2, paraSpaceAfter: 9 },
    );
  });

  s.addText("→", { x: M + lw + 0.06, y: 3.7, w: 0.38, h: 0.4, margin: 0, align: "center", fontFace: BODY, fontSize: 22, color: MUTED });
  s.addText("→", { x: M + lw * 2 + 0.56, y: 3.7, w: 0.38, h: 0.4, margin: 0, align: "center", fontFace: BODY, fontSize: 22, color: GREEN });

  s.addText(
    "Единственный путь внутрь — через шлюз. Клиентская база, договоры и персональные данные наружу не выходят: обратно уезжает только согласованный документ или шаблонное письмо.",
    { x: M, y: 6.05, w: 11.6, h: 0.6, margin: 0, fontFace: BODY, fontSize: 13, color: MUTED },
  );
}

// ——— 4. три двери ———
{
  const s = pres.addSlide();
  slideTitle(s, "Периметр", "Три двери, и четвёртой не будет");
  s.addText(
    "Новая функция приезжает в одну из трёх. Тогда периметр проверяется в трёх местах, а не в тридцати контроллерах.",
    { x: M, y: 1.42, w: 11.2, h: 0.4, margin: 0, fontFace: BODY, fontSize: 14, color: TEXT_2 },
  );

  const doors = [
    ["/api/public/v1/**", "сборка сайта, Урания", "Только чтение, только опубликованное, кэшируется на пять минут"],
    ["/api/forms/v1/leads", "формы сайта, почта", "Единственная запись снаружи. Идемпотентность по ключу: повторный клик не создаёт вторую заявку"],
    ["/admin/**", "сотрудник", "Сессия и роли. Закрывается целиком на прокси, код от выбора не зависит"],
  ];
  doors.forEach((d, i) => {
    const y = 2.15 + i * 1.42;
    card(s, M, y, CW, 1.2);
    s.addText(d[0], {
      x: M + 0.32, y: y + 0.2, w: 3.5, h: 0.34, margin: 0,
      fontFace: MONO, fontSize: 14, bold: true, color: GREEN_DARK,
    });
    s.addText(d[1], {
      x: M + 0.32, y: y + 0.62, w: 3.5, h: 0.3, margin: 0,
      fontFace: BODY, fontSize: 12.5, color: MUTED,
    });
    s.addText(d[2], {
      x: M + 4.15, y: y + 0.28, w: CW - 4.6, h: 0.7, margin: 0,
      fontFace: BODY, fontSize: 14, color: TEXT_2,
    });
  });
  s.addNotes("Решение спеки: четвёртой двери не заводим.");
}

// ——— 5. путь заявки ———
{
  const s = pres.addSlide();
  slideTitle(s, "Механика", "Путь заявки — он же границы модулей");

  const steps = [
    ["Заявка", "сайт · форма · почта", SOFT, INK],
    ["gateway", "источник, поля, вложения", OK_BG, GREEN_DARK],
    ["crm", "черновик лида", OK_BG, GREEN_DARK],
    ["notifications", "шаблонное письмо", OK_BG, GREEN_DARK],
    ["Клиент", "получает ответ", SOFT, INK],
  ];
  const sw = 2.24;
  const gap = (CW - sw * 5) / 4;
  steps.forEach((st, i) => {
    const x = M + i * (sw + gap);
    card(s, x, 2.05, sw, 1.35, st[2]);
    s.addText(st[0], {
      x: x + 0.18, y: 2.28, w: sw - 0.36, h: 0.36, margin: 0,
      fontFace: HEAD, fontSize: 15, bold: true, color: st[3],
    });
    s.addText(st[1], {
      x: x + 0.18, y: 2.68, w: sw - 0.36, h: 0.5, margin: 0,
      fontFace: BODY, fontSize: 11.5, color: MUTED,
    });
    if (i < 4) {
      s.addText("→", {
        x: x + sw, y: 2.5, w: gap, h: 0.4, margin: 0,
        align: "center", fontFace: BODY, fontSize: 20, color: MUTED,
      });
    }
  });

  card(s, M + sw + gap, 4.3, sw * 3 + gap * 2, 0.95, WAIT_BG);
  s.addText("audit · журнал только на добавление", {
    x: M + sw + gap + 0.3, y: 4.55, w: sw * 3, h: 0.45, margin: 0,
    fontFace: BODY, fontSize: 14, bold: true, color: TEXT_2,
  });
  [1, 2, 3].forEach((i) => {
    const x = M + i * (sw + gap) + sw / 2;
    s.addText("↓", { x: x - 0.2, y: 3.45, w: 0.4, h: 0.75, margin: 0, align: "center", fontFace: BODY, fontSize: 16, color: MUTED });
  });

  s.addText(
    "Запись в базу и событие коммитятся одной транзакцией, поэтому заявка не теряется, даже если письмо не ушло. Правку журнала задним числом запрещает триггер базы, а не дисциплина.",
    { x: M, y: 5.75, w: 11.6, h: 0.6, margin: 0, fontFace: BODY, fontSize: 13.5, color: MUTED },
  );
}

// ——— 6. готовые модули ———
{
  const s = pres.addSlide();
  slideTitle(s, "Модули", "Семь готовы целиком");
  s.addText(
    "Одно приложение, одна база. Модули — границы пакетов ru.vedal.portal.*, а не отдельные деплои: пятьдесят сотрудников не требуют микросервисов.",
    { x: M, y: 1.45, w: 11.4, h: 0.55, margin: 0, fontFace: BODY, fontSize: 14, color: TEXT_2 },
  );

  const mods = [
    ["catalog", "Продукция и категории, публичное API, правка и публикация в админке"],
    ["content", "Новости и пресс-центр. Пустая лента — нормальное состояние"],
    ["documents", "Перечень, статусы доступа, выдача файла за портом FileStorage"],
    ["gateway", "Приём заявок: проверка, honeypot, лимит частоты, идемпотентность"],
    ["audit", "Журнал только на добавление, правку запрещает триггер базы"],
    ["common", "Ошибки в одном формате, транзакционный outbox, лимиты"],
    ["app", "Сборка, четыре окружения, проверка переменных до старта, CORS"],
  ];
  const cw2 = (CW - 0.4) / 2;
  mods.forEach((m, i) => {
    const x = M + (i % 2) * (cw2 + 0.4);
    const y = 2.05 + Math.floor(i / 2) * 1.12;
    card(s, x, y, cw2, 0.95);
    s.addText(m[0], {
      x: x + 0.28, y: y + 0.13, w: 2.6, h: 0.32, margin: 0,
      fontFace: MONO, fontSize: 14, bold: true, color: INK,
    });
    chip(s, x + cw2 - 1.56, y + 0.14, "ГОТОВ", OK_BG, GREEN_DARK);
    s.addText(m[1], {
      x: x + 0.28, y: y + 0.48, w: cw2 - 0.56, h: 0.4, margin: 0,
      fontFace: BODY, fontSize: 12, color: TEXT_2,
    });
  });
}

// ——— 7. наполовину ———
{
  const s = pres.addSlide();
  slideTitle(s, "Модули", "Четыре сделаны наполовину");

  const half = [
    ["crm", "Лиды принимаются и видны в админке.", "Нет сделок, КП, статусов и ответственного"],
    ["notifications", "Шаблоны, очередь и учёт доставки готовы.", "Письма уходят в лог: SMTP Яндекс 360 не подключён"],
    ["assistant", "Ограничения и передача человеку работают.", "За портом LlmEngine поиск по словам, модели нет"],
    ["iam", "Вход в админку на локальных учётках.", "Keycloak и MFA ждут согласования закрытого контура"],
  ];
  const cw3 = (CW - 0.4) / 2;
  half.forEach((m, i) => {
    const x = M + (i % 2) * (cw3 + 0.4);
    const y = 1.75 + Math.floor(i / 2) * 2.35;
    card(s, x, y, cw3, 2.05);
    s.addText(m[0], {
      x: x + 0.3, y: y + 0.22, w: 3, h: 0.34, margin: 0,
      fontFace: MONO, fontSize: 15, bold: true, color: INK,
    });
    chip(s, x + cw3 - 1.58, y + 0.24, "НАПОЛОВИНУ", PART_BG, PART_FG);
    s.addText(m[1], {
      x: x + 0.3, y: y + 0.68, w: cw3 - 0.6, h: 0.4, margin: 0,
      fontFace: BODY, fontSize: 13.5, color: TEXT_2,
    });
    s.addText(m[2], {
      x: x + 0.3, y: y + 1.15, w: cw3 - 0.6, h: 0.6, margin: 0,
      fontFace: BODY, fontSize: 13.5, bold: true, color: PART_FG,
    });
  });

  s.addText(
    "Плюс knowledge и vlm — AI-поиск по внутренним документам и визуальные модели для сервиса. Не начаты, это отдельные этапы роадмапа.",
    { x: M, y: 6.35, w: 11.6, h: 0.5, margin: 0, fontFace: BODY, fontSize: 13, color: MUTED },
  );
}

// ——— 8. соединили сегодня ———
{
  const s = pres.addSlide();
  slideTitle(s, "Сделано на этой неделе", "Сайт и бэкенд соединены");
  s.addText(
    "До этого обе половины были написаны по одной спеке, но между ними не было ни одного провода: формы никуда не отправлялись, Урания отвечала заготовками, каталог жил в файле фронтенда.",
    { x: M, y: 1.45, w: 11.6, h: 0.55, margin: 0, fontFace: BODY, fontSize: 14, color: TEXT_2 },
  );

  const items = [
    ["Чтение — на сборке", "Каталог, новости и документы приходят из публичного API и обновляются раз в пять минут. Падение бэкенда не роняет уже собранный сайт."],
    ["Запись — из браузера", "Формы уходят с ключом идемпотентности, Урания спрашивает Assistant API и показывает ссылки на источники."],
    ["Нет источников — нет ответа", "Ассистент не придумывает. Когда подходящих опубликованных материалов нет, идёт передача человеку с контактами."],
    ["Фотографии — из MinIO", "Медиа переехали в объектное хранилище. Локально MinIO, в облаке Yandex Object Storage: оба говорят на S3."],
  ];
  const cw4 = (CW - 0.4) / 2;
  items.forEach((it, i) => {
    const x = M + (i % 2) * (cw4 + 0.4);
    const y = 2.1 + Math.floor(i / 2) * 2.2;
    card(s, x, y, cw4, 1.9, i === 3 ? OK_BG : SOFT);
    s.addText(it[0], {
      x: x + 0.3, y: y + 0.24, w: cw4 - 0.6, h: 0.36, margin: 0,
      fontFace: HEAD, fontSize: 16, bold: true, color: i === 3 ? GREEN_DARK : INK,
    });
    s.addText(it[1], {
      x: x + 0.3, y: y + 0.68, w: cw4 - 0.6, h: 1.05, margin: 0,
      fontFace: BODY, fontSize: 13.5, color: TEXT_2, lineSpacing: 19,
    });
  });
}

// ——— 9-10. план ———
function planSlide(title, from, rows, note) {
  const s = pres.addSlide();
  slideTitle(s, "План", title);
  rows.forEach((r, i) => {
    const y = 1.75 + i * 1.28;
    s.addText(String(from + i).padStart(2, "0"), {
      x: M, y: y + 0.08, w: 0.85, h: 0.6, margin: 0,
      fontFace: HEAD, fontSize: 30, bold: true, color: GREEN,
    });
    s.addText(r[0], {
      x: M + 0.95, y: y, w: 7.4, h: 0.36, margin: 0,
      fontFace: HEAD, fontSize: 17, bold: true, color: INK,
    });
    s.addText(r[1], {
      x: M + 0.95, y: y + 0.4, w: 8.6, h: 0.72, margin: 0,
      fontFace: BODY, fontSize: 13.5, color: TEXT_2, lineSpacing: 18,
    });
    chip(s, W - M - 1.4, y + 0.06, r[2], r[3] === "ok" ? OK_BG : PART_BG, r[3] === "ok" ? GREEN_DARK : PART_FG);
  });
  if (note) {
    s.addText(note, { x: M, y: 6.5, w: 11.6, h: 0.5, margin: 0, fontFace: BODY, fontSize: 13, color: MUTED });
  }
}

planSlide(
  "Что делаем дальше",
  1,
  [
    ["Потребители событий переезжают в Kafka", "Публикация из outbox готова, топики заводит приложение. Осталось заставить потребителей читать из топиков, а не из процесса, и добавить очередь разбора для битых событий.", "БЭКЕНД", "ok"],
    ["Keycloak и MFA вместо локальных учёток", "Вход строится на покупном провайдере идентичности, у нас остаётся модель ролей. Это условие для всего закрытого контура.", "БЭКЕНД", "ok"],
    ["Документы в объектное хранилище", "MinIO уже поднят и медиа в нём. Осталось перевести туда документы: клиент на AWS SDK, приватный бакет, подписанные ссылки.", "БЭКЕНД", "ok"],
    ["CRM целиком", "Клиенты, сделки, КП, статусы, ответственный, дилерская и сервисная воронки, аналитика по изделию и источнику.", "БЭКЕНД", "ok"],
  ],
  "Порядок не произвольный: каждый шаг оставляет работающее приложение.",
);

planSlide(
  "Что делаем дальше",
  5,
  [
    ["Живые письма и живая модель", "Почта переключается на SMTP Яндекс 360. Урания получает YandexGPT и pgvector. Ограничения остаются в коде до вызова модели, а не в промпте.", "БЭКЕНД", "ok"],
    ["Пресс-центр, партнёры, SEO и аналитика", "Двух страниц из карты сайта ещё нет. Плюс метаданные, разметка изделий, Яндекс Метрика и десять именованных событий — список уже согласован.", "ФРОНТЕНД", "ok"],
    ["Переезд в облако", "VM, Managed PostgreSQL и Kafka, объектное хранилище, бэкапы с проверкой восстановления, мониторинг, сборка с деплоем.", "ИНФРА", "part"],
  ],
  "Последний шаг упирается в Yandex Cloud, которого пока нет: до него бэкенд живёт локально, а сайт остаётся статикой.",
);

// ——— 11. как включиться ———
{
  const s = pres.addSlide();
  slideTitle(s, "Онбординг", "Как включиться");

  const half = (CW - 0.5) / 2;
  s.addText("Поднять у себя", {
    x: M, y: 1.7, w: half, h: 0.34, margin: 0,
    fontFace: HEAD, fontSize: 17, bold: true, color: INK,
  });
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 2.15, w: half, h: 2.5, rectRadius: 0.05,
    fill: { color: DEEP_2 }, line: { color: DEEP_2, width: 0 },
  });
  s.addText(
    "# база, брокер и хранилище\ndocker compose -f backend/compose.yaml up -d\n\n# фотографии в хранилище\nnode backend/tools/upload-media.mjs\n\n# бэкенд, порт 8081\ncd backend && ./mvnw spring-boot:run\n\n# сайт, порт 3000\ncd frontend && npm run dev",
    { x: M + 0.28, y: 2.35, w: half - 0.56, h: 2.1, margin: 0, fontFace: MONO, fontSize: 11.5, color: "D6E4DE", lineSpacing: 16 },
  );
  s.addText(
    "Нужны JDK 25, Node 24 и Docker. Тесты идут на настоящем PostgreSQL, поэтому Docker обязателен именно для них. Настройки сайта — frontend/.env.example.",
    { x: M, y: 4.8, w: half, h: 0.8, margin: 0, fontFace: BODY, fontSize: 13, color: TEXT_2, lineSpacing: 18 },
  );

  const rx = M + half + 0.5;
  s.addText("Куда коммитить", {
    x: rx, y: 1.7, w: half, h: 0.34, margin: 0,
    fontFace: HEAD, fontSize: 17, bold: true, color: INK,
  });
  const branches = [
    ["back", "серверная логика, тесты бэкенда"],
    ["front", "клиент, стили, тесты фронтенда"],
    ["db", "миграции, SQL, seed-данные"],
    ["infra", "сборка, CI/CD, Docker, зависимости"],
    ["docs", "документация и спеки"],
    ["dev", "интеграция, здесь всё тестируется вместе"],
    ["main", "только протестированное"],
  ];
  branches.forEach((b, i) => {
    const y = 2.2 + i * 0.44;
    s.addText(b[0], {
      x: rx, y, w: 1.15, h: 0.34, margin: 0,
      fontFace: MONO, fontSize: 13, bold: true, color: GREEN_DARK,
    });
    s.addText(b[1], {
      x: rx + 1.2, y, w: half - 1.2, h: 0.34, margin: 0,
      fontFace: BODY, fontSize: 13, color: TEXT_2,
    });
  });
  s.addText(
    "Коммиты — Conventional Commits с префиксом слоя. В dev мержим с --no-ff, в main — только после зелёных тестов.",
    { x: rx, y: 5.4, w: half, h: 0.6, margin: 0, fontFace: BODY, fontSize: 13, color: TEXT_2, lineSpacing: 18 },
  );

  s.addText(
    "Начинать читать — с docs/PROJECT.md. Там суть, архитектура, раскладка репозитория и открытые вопросы; остальные сорок документов — детализация. Вся документация ведётся парами ru и en с переключателем внутри файла.",
    { x: M, y: 6.35, w: CW, h: 0.6, margin: 0, fontFace: BODY, fontSize: 13, color: MUTED, lineSpacing: 18 },
  );
}

// ——— 12. риски ———
{
  const s = darkSlide();
  s.addText("ЧТО МЕШАЕТ", {
    x: M, y: 0.72, w: CW, h: 0.3, margin: 0,
    fontFace: BODY, fontSize: 12, bold: true, color: GREEN_ON_DARK, charSpacing: 2,
  });
  s.addText("Риски и чего ждём", {
    x: M, y: 1.02, w: CW, h: 0.6, margin: 0,
    fontFace: HEAD, fontSize: 30, bold: true, color: "FFFFFF",
  });

  const risks = [
    ["Расхождения в документах", "Пять штук, каждое зафиксировано как нерешённое: 50 или 60 сотрудников, Kafka или Redis, своя CRM или коробочная, «около десяти» или тринадцать изделий."],
    ["Данных по продукции нет", "Датащитами подтверждены три позиции из двенадцати. Статус регистрации не подтверждён ни у одной, фотографий отдельными файлами нет."],
    ["Облака нет", "Всё, что упирается в Yandex Cloud, стоит: Managed PostgreSQL и Kafka, бэкапы, мониторинг, развёртывание. Бэкенд пока живёт локально."],
    ["Ждут подтверждения", "Допустимая потеря данных и время подъёма, срок хранения заявок, закрывать ли админку по сети, когда подключаем Keycloak."],
  ];
  const cw5 = (CW - 0.5) / 2;
  risks.forEach((r, i) => {
    const x = M + (i % 2) * (cw5 + 0.5);
    const y = 2.1 + Math.floor(i / 2) * 2.1;
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: cw5, h: 1.8, rectRadius: 0.05,
      fill: { color: DEEP_2 }, line: { color: "1E3A34", width: 0.75 },
    });
    s.addText(r[0], {
      x: x + 0.3, y: y + 0.22, w: cw5 - 0.6, h: 0.34, margin: 0,
      fontFace: HEAD, fontSize: 16, bold: true, color: GREEN_ON_DARK,
    });
    s.addText(r[1], {
      x: x + 0.3, y: y + 0.64, w: cw5 - 0.6, h: 1, margin: 0,
      fontFace: BODY, fontSize: 13, color: ON_DARK, lineSpacing: 18,
    });
  });

  s.addText(
    "Источник истины — docs/PROJECT.md в репозитории. Эта презентация — срез на 13 августа 2026; если расходится с репозиторием, прав репозиторий.",
    { x: M, y: 6.5, w: CW, h: 0.5, margin: 0, fontFace: BODY, fontSize: 12.5, color: MUTED },
  );
}

const out = process.argv[2] ?? "vedal-portal-status.pptx";
await pres.writeFile({ fileName: out });
console.log("готово:", out);
