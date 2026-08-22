// Запись наружу: заявки и вопросы Ведалине. В отличие от `api.ts`, эти вызовы
// идут из браузера, поэтому бэкенд должен разрешить источник сайта в CORS
// (`VEDAL_ALLOWED_ORIGINS`).
//
// Две двери из спеки серверной части: `POST /api/forms/v1/leads` —
// единственная запись снаружи, `POST /api/assistant/v1/ask` — ассистент.

export const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
export const apiConfigured = apiUrl !== "";

/** Типы форм из спеки: тело заявки без него бэкенд не примет. */
export type LeadForm = "quote" | "catalog" | "consultation" | "service" | "partner";

export type LeadDraft = {
  form: LeadForm;
  name: string;
  company?: string;
  phone: string;
  email: string;
  productSlug?: string;
  /**
   * Серийный номер изделия. Только сервисное обращение: в запросе цены или
   * каталога изделия у человека ещё нет. Формат бэкенд не проверяет —
   * вид номера VEDAL в согласованных материалах не описан; проверяется
   * только длина, 100 символов.
   */
  serialNumber?: string;
  message: string;
  consent: boolean;
  /** Язык страницы, двухбуквенный код. Разрез аналитики CRM. */
  language?: string;
  /** Кампания, приведшая посетителя: `utm_campaign`. Разрез аналитики CRM. */
  campaign?: string;
  /** Honeypot: поле скрыто в разметке, человек его не заполняет. */
  trap?: string;
};

/**
 * Атрибуция заявки: язык страницы и кампания.
 *
 * Кампания берётся из `utm_campaign` в адресе. Читается один раз, при монтировании
 * формы: посетитель приходит по ссылке с меткой, ходит по сайту и отправляет заявку
 * уже с другого адреса — брать метку в момент отправки значит потерять её у всех,
 * кто не отправил форму на первой же странице.
 *
 * Ничего, кроме метки кампании, отсюда не берётся: остальные `utm_*` — это профиль
 * посетителя, а не то, что нужно CRM.
 */
export function attribution(search: string, documentLanguage: string): {
  language?: string;
  campaign?: string;
} {
  const campaign = new URLSearchParams(search).get("utm_campaign")?.trim();
  // Бэкенд ждёт двухбуквенный код, а <html lang> бывает и «ru-RU».
  const language = documentLanguage.trim().slice(0, 2).toLowerCase();

  return {
    language: /^[a-z]{2}$/.test(language) ? language : undefined,
    campaign: campaign ? campaign.slice(0, 200) : undefined,
  };
}

export type SubmitResult =
  | { ok: true; message: string }
  /** `fields` заполнен, когда бэкенд разобрал ошибку по полям. */
  | { ok: false; message: string; fields?: Record<string, string> };

type Problem = { title?: string; detail?: string; fields?: Record<string, string> };

// Ключ идемпотентности живёт столько же, сколько заполняемая форма: повторный
// клик по «Отправить» не должен создать вторую заявку, а новое обращение
// с той же страницы — должен.
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Старые браузеры без randomUUID: ключ нужен только для различения
  // повторов, криптостойкость здесь ни при чём.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Тексты короткие и без контактов: контакты — забота интерфейса, он их и так
// показывает. Иначе рядом оказываются два одинаковых телефона.
const UNREACHABLE = "Не удалось отправить: сервер не отвечает.";

const NOT_CONFIGURED = "Отправка заявок ещё не подключена в этой сборке.";

export async function submitLead(draft: LeadDraft, idempotencyKey: string): Promise<SubmitResult> {
  if (!apiConfigured) return { ok: false, message: NOT_CONFIGURED };

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/forms/v1/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(draft),
    });
  } catch {
    return { ok: false, message: UNREACHABLE };
  }

  if (response.ok) {
    const body = (await response.json()) as { message?: string };
    // Текст подтверждения приходит с бэкенда: он же лежит в модели формы
    // в docs/frontend/content_model.md, дублировать его здесь незачем.
    return { ok: true, message: body.message ?? "Спасибо. Специалист VEDAL свяжется с вами." };
  }

  const problem = await readProblem(response);
  return {
    ok: false,
    message: problem.title ?? problem.detail ?? `Не удалось отправить (${response.status}).`,
    fields: problem.fields,
  };
}

// ————— ассистент —————

export type Source = { title: string; url: string; kind?: string };

export type Handoff = { reason: string; phone: string; email: string; forms: string[] };

export type AskReply = {
  answer: string | null;
  sources: Source[];
  /** Заполнен, когда подходящих опубликованных источников нет. */
  handoff: Handoff | null;
};

export async function askVedalina(question: string): Promise<AskReply | { error: string }> {
  if (!apiConfigured) return { error: NOT_CONFIGURED };

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/assistant/v1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
  } catch {
    return { error: UNREACHABLE };
  }

  if (response.ok) return (await response.json()) as AskReply;

  const problem = await readProblem(response);
  return { error: problem.title ?? problem.detail ?? `Ассистент недоступен (${response.status}).` };
}

// Ошибка приходит как application/problem+json (RFC 9457). Тело может
// оказаться и не JSON — например, когда до приложения не дошло и ответил
// прокси; тогда возвращаем пустой разбор, а не роняем обработчик.
async function readProblem(response: Response): Promise<Problem> {
  try {
    return (await response.json()) as Problem;
  } catch {
    return {};
  }
}

// ————— разговор —————
//
// Отличие от `askVedalina` одно, но оно меняет всё: разговор помнит. Ведалина
// отвечает, пока может; когда источников нет, разговор встаёт в очередь
// к человеку, и дальше отвечает сотрудник — а Ведалина молчит.
//
// Дверь та же, `/api/assistant/v1`: она уже принимает свободный текст от
// анонима и уже стоит под лимитом частоты. Четвёртой двери не заводится.

export type ChatAuthor = "visitor" | "assistant" | "staff";

export type ChatLine = {
  author: ChatAuthor;
  /** Имя сотрудника. У Ведалины и у самого посетителя пусто. */
  actor: string | null;
  body: string;
  /** Материалы, на которых построен ответ Ведалины. У остальных пусто. */
  sources: Source[];
  /** Когда прочитано собеседником. null — ещё нет. */
  readAt: string | null;
  at: string;
};

export type ChatThread = {
  id: string | null;
  status: "open" | "waiting" | "attended" | "closed";
  messages: ChatLine[];
};

const VISITOR_KEY = "vedal.chat.visitor";

/**
 * Ключ вкладки. Случайный, живёт в браузере, о человеке не сообщает ничего —
 * по нему находится разговор после перезагрузки страницы.
 *
 * Ключ — единственное, что закрывает разговор: кто его знает, тот читает
 * переписку. Поэтому источник случайности только криптографический.
 *
 * Хранилище может быть недоступно: приватный режим, запрет сторонних данных.
 * Тогда ключ живёт до перезагрузки — разговор не потеряется в пределах сеанса,
 * а исключение не должно ронять виджет.
 */
export function visitorKey(): string {
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved) return saved;
    const key = freshVisitorKey();
    localStorage.setItem(VISITOR_KEY, key);
    return key;
  } catch {
    return freshVisitorKey();
  }
}

/**
 * Шестнадцать случайных байт.
 *
 * `crypto.randomUUID` существует только в защищённом контексте — https или
 * localhost. Стенд ходит по http, и там его нет: раньше в этом случае ключ
 * выдавал `Math.random()`, то есть на стенде работала именно слабая ветка,
 * а не запасная. `crypto.getRandomValues` доступен и по http.
 *
 * Запасного пути на случай отсутствия crypto нет намеренно. Он был бы ровно
 * тем, от чего здесь уходят, а браузера без `getRandomValues` современный
 * сборщик всё равно не поддерживает: пусть виджет сломается заметно, чем
 * тихо раздаст угадываемые ключи к чужой переписке.
 */
function freshVisitorKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Написать в чат.
 *
 * @param intent какую кнопку нажали. Пусто — человек напечатал сам.
 *   Портал выбирает заготовку по намерению, а не по совпадению подписи:
 *   подпись живёт здесь и меняется вместе с интерфейсом, а совпадение
 *   по ней разъехалось бы молча — ответ просто перестал бы находиться.
 */
export async function sayInChat(
  visitor: string,
  text: string,
  intent?: string,
): Promise<ChatThread | { error: string }> {
  if (!apiConfigured) return { error: NOT_CONFIGURED };

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/assistant/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorKey: visitor,
        text,
        intent: intent ?? null,
        // Атрибуция снимается при отправке первого сообщения: язык страницы
        // и метка кампании — свойство того, откуда человек пришёл, и позже
        // взять их уже неоткуда.
        language: document.documentElement.lang || null,
        campaign: new URLSearchParams(location.search).get("utm_campaign"),
        page: location.pathname,
      }),
    });
  } catch {
    return { error: UNREACHABLE };
  }

  if (response.ok) return (await response.json()) as ChatThread;

  const problem = await readProblem(response);
  return { error: problem.title ?? problem.detail ?? `Чат недоступен (${response.status}).` };
}

/** Кнопка быстрого ответа. Список приходит с портала, а не переписан сюда. */
export type Prompt = { intent: string; label: string; action: "ask" | "handoff" };

/**
 * Кнопки виджета.
 *
 * Портал кэширует ответ на час, поэтому запрос дешёвый. Не дошёл —
 * кнопок нет вовсе, и это правильнее, чем показать список из прошлой
 * версии интерфейса: кнопка, отправляющая намерение, которого портал
 * не знает, снова превращается в вопрос с подписью вместо текста.
 */
export async function chatPrompts(): Promise<Prompt[]> {
  if (!apiConfigured) return [];
  try {
    const response = await fetch(`${apiUrl}/api/assistant/v1/prompts`);
    return response.ok ? ((await response.json()) as Prompt[]) : [];
  } catch {
    return [];
  }
}

/**
 * Позвать живого человека.
 *
 * Отдельная дверь, а не сообщение с особым текстом. Раньше кнопка
 * «Специалист VEDAL» отправляла свою подпись как вопрос — и поиск отвечал
 * на неё каталогом, а разговор оставался у Ведалины.
 */
export async function callHuman(visitor: string): Promise<ChatThread | { error: string }> {
  if (!apiConfigured) return { error: NOT_CONFIGURED };

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/assistant/v1/chat/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorKey: visitor,
        language: document.documentElement.lang || null,
        campaign: new URLSearchParams(location.search).get("utm_campaign"),
        page: location.pathname,
      }),
    });
  } catch {
    return { error: UNREACHABLE };
  }

  if (response.ok) return (await response.json()) as ChatThread;

  const problem = await readProblem(response);
  return { error: problem.title ?? problem.detail ?? `Чат недоступен (${response.status}).` };
}

export async function chatThread(visitor: string): Promise<ChatThread | null> {
  if (!apiConfigured) return null;
  try {
    const response = await fetch(`${apiUrl}/api/assistant/v1/chat/${encodeURIComponent(visitor)}`);
    return response.ok ? ((await response.json()) as ChatThread) : null;
  } catch {
    return null;
  }
}

/** Адрес потока обновлений. Подписка живёт в компоненте — ей нужен его срок жизни. */
export function chatStreamUrl(visitor: string): string | null {
  return apiConfigured
    ? `${apiUrl}/api/assistant/v1/chat/${encodeURIComponent(visitor)}/stream`
    : null;
}

/**
 * Сообщить, что посетитель печатает.
 *
 * Ничего не возвращает и ошибок не поднимает: это подсказка, а не действие.
 * Не дошла — сотрудник просто не увидит надписи, и ничего не сломается.
 */
export function pingTyping(visitor: string): void {
  if (!apiConfigured) return;
  void fetch(`${apiUrl}/api/assistant/v1/chat/${encodeURIComponent(visitor)}/typing`, {
    method: "POST",
  }).catch(() => {});
}
