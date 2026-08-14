// Запись наружу: заявки и вопросы Урании. В отличие от `api.ts`, эти вызовы
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

export async function askUrania(question: string): Promise<AskReply | { error: string }> {
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
