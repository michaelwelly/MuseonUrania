// Клиент админского API портала.
//
// В отличие от `api.ts`, который читает опубликованное на сборке, этот
// работает только в браузере и только с токеном. Здесь видно всё, включая
// черновики, внутренние документы и персональные данные в заявках, —
// поэтому ни один вызов отсюда не должен попасть в серверный рендер.

import { accessToken } from "./auth";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export const adminConfigured = BASE !== "";

const ROOT = "/api/admin/v1";

/** Отказ портала, разобранный из problem+json. */
export class AdminError extends Error {
  readonly status: number;
  /** Разбор по полям формы: заполнен только у 400. */
  readonly fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

type Problem = { title?: string; detail?: string; fields?: Record<string, string> };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!adminConfigured) {
    throw new AdminError(0, "Адрес API не задан: NEXT_PUBLIC_API_URL.");
  }

  const token = await accessToken();
  if (!token) throw new AdminError(401, "Вход не выполнен.");

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  // Content-Type для multipart проставляет сам браузер вместе с boundary —
  // подставить его руками значит отправить тело, которое сервер не разберёт.
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${ROOT}${path}`, { ...init, headers });
  } catch {
    // Сеть, а не портал: до него запрос не дошёл вовсе. Отличается
    // от отказа портала тем, что статуса нет.
    throw new AdminError(0, "Портал не отвечает.");
  }

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    let problem: Problem = {};
    try {
      problem = (await response.json()) as Problem;
    } catch {
      // Не problem+json — значит, отвечал не портал, а что-то перед ним.
    }
    throw new AdminError(
      response.status,
      problem.title ?? problem.detail ?? `Портал ответил ${response.status}`,
      problem.fields,
    );
  }

  return (await response.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });
// Обобщён с прежним поведением по умолчанию: удаление карточки ничего не
// возвращает, а уничтожение персональных данных отвечает, что именно сделано.
const del = <T = void>(path: string) => request<T>(path, { method: "DELETE" });

// ————— сессия —————

export type Session = { actor: string; roles: string[]; authentication: string };

export const session = () => get<Session>("/session");

// ————— каталог —————

export type Spec = { label: string; value: string; muted: boolean };

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  summary: string;
  docStatus: string;
  published: boolean;
  sortOrder: number;
  /** Снимок изделия. Пусто — снимка нет; на сайте это пустая рамка. */
  imageSrc: string | null;
  /** Названия категорий, а не адреса: список читает человек. */
  categories: string[];
  updatedAt: string;
};

export type Product = {
  id: string;
  /** Версия карточки. Её надо вернуть в форме правки: по ней портал отличает
   *  «правлю то, что прочитал» от «правлю то, что за это время поменял другой». */
  version: number;
  slug: string;
  name: string;
  kind: string;
  summary: string;
  detail: string | null;
  /** Назначение изделия. null — места под текст пустое, карточка покажет
   *  «ожидает уточнения». */
  purpose: string | null;
  /** Ключевые особенности, по одному утверждению в строке. */
  features: string[];
  docStatus: string;
  published: boolean;
  sortOrder: number;
  imageSrc: string | null;
  imageAlt: string | null;
  categorySlugs: string[];
  keyParams: Spec[];
  specs: Spec[];
  createdAt: string;
  updatedAt: string;
};

export type ProductForm = Omit<Product, "id" | "published" | "createdAt" | "updatedAt">;

export type Category = {
  id: string;
  slug: string;
  name: string;
  position: number;
  productCount: number;
};

export const products = () => get<ProductRow[]>("/products");
export const product = (id: string) => get<Product>(`/products/${id}`);
export const createProduct = (form: ProductForm) => post<Product>("/products", form);
export const updateProduct = (id: string, form: ProductForm) =>
  put<Product>(`/products/${id}`, form);
export const publishProduct = (id: string, published: boolean) =>
  post<Product>(`/products/${id}/${published ? "publish" : "unpublish"}`);

export const categories = () => get<Category[]>("/categories");
export const createCategory = (form: Omit<Category, "id" | "productCount">) =>
  post<Category>("/categories", form);
export const updateCategory = (id: string, form: Omit<Category, "id" | "productCount">) =>
  put<Category>(`/categories/${id}`, form);
export const deleteCategory = (id: string) => del(`/categories/${id}`);

// ————— новости —————

export type NewsRow = {
  id: string;
  slug: string;
  tag: string;
  title: string;
  published: boolean;
  publishedOn: string | null;
  updatedAt: string;
};

export type News = NewsRow & {
  version: number;
  excerpt: string;
  body: string | null;
  imageSrc: string | null;
  imageAlt: string | null;
  createdAt: string;
};

export type NewsForm = Omit<News, "id" | "published" | "createdAt" | "updatedAt">;

export const news = () => get<NewsRow[]>("/news");
export const newsTags = () => get<string[]>("/news/tags");
export const newsItem = (id: string) => get<News>(`/news/${id}`);
export const createNews = (form: NewsForm) => post<News>("/news", form);
export const updateNews = (id: string, form: NewsForm) => put<News>(`/news/${id}`, form);
export const publishNews = (id: string, published: boolean) =>
  post<News>(`/news/${id}/${published ? "publish" : "unpublish"}`);
export const deleteNews = (id: string) => del(`/news/${id}`);

// ————— документы —————

export type DocumentRow = {
  id: string;
  version: number;
  slug: string;
  title: string;
  group: string;
  subject: string;
  productSlug: string | null;
  sensitivity: string;
  access: string;
  listed: boolean;
  published: boolean;
  hasFile: boolean;
  fileSize: number | null;
  revision: string | null;
  approvedBy: string | null;
  updatedAt: string;
  /** Почему кнопка публикации недоступна. null — можно публиковать. */
  publishBlockedBy: string | null;
};

export type DocumentForm = Omit<
  DocumentRow,
  "id" | "published" | "hasFile" | "fileSize" | "approvedBy" | "updatedAt" | "publishBlockedBy"
> & { sourceOwner: string | null };

export type Vocabulary = { groups: string[]; sensitivities: string[]; access: string[] };

export const documents = () => get<DocumentRow[]>("/documents");
export const documentVocabulary = () => get<Vocabulary>("/documents/vocabulary");
export const createDocument = (form: DocumentForm) => post<DocumentRow>("/documents", form);
export const updateDocument = (id: string, form: DocumentForm) =>
  put<DocumentRow>(`/documents/${id}`, form);
export const publishDocument = (id: string, published: boolean) =>
  post<DocumentRow>(`/documents/${id}/${published ? "publish" : "unpublish"}`);

export function uploadDocumentFile(id: string, file: File) {
  const body = new FormData();
  body.append("file", file);
  return request<DocumentRow>(`/documents/${id}/file`, { method: "POST", body });
}

// ————— изображения —————

export type Uploaded = { path: string; size: number };

export function uploadMedia(file: File, folder: string, name: string) {
  const body = new FormData();
  body.append("file", file);
  const query = new URLSearchParams({ folder, name });
  return request<Uploaded>(`/media?${query}`, { method: "POST", body });
}

// ————— заявки —————

export type Page<T> = { items: T[]; page: number; size: number; total: number; pages: number };

export type LeadRow = {
  id: string;
  form: string;
  name: string;
  company: string | null;
  phone: string;
  email: string;
  productSlug: string | null;
  source: string;
  status: string;
  owner: string | null;
  /** Сделка, в которую разобрана заявка. Пусто — ещё не разобрана. */
  dealId: string | null;
  createdAt: string;
};

export type Lead = LeadRow & {
  message: string;
  /**
   * Серийный номер изделия из сервисного обращения. Пусто — не указан.
   * В строке списка его нет намеренно: он для карточки, а список и так
   * широкий. Найти по нему заявку можно через общий поиск.
   */
  serialNumber: string | null;
  consentVersion: string;
  consentAt: string;
  correlationId: string | null;
  /** Когда персональные данные уничтожены. Пусто — не уничтожались. */
  erasedAt: string | null;
};

/**
 * Отбор списка заявок. Признаки складываются, а не заменяют друг друга.
 *
 * Отбирает портал, а не браузер, и это не безразлично: фильтр в браузере
 * работает по загруженной странице и со второй страницы молча врёт —
 * «ничего не найдено» там означает «на этой странице нет».
 */
export type LeadFilter = {
  status?: string;
  /** Поиск по имени, компании, телефону и почте. */
  query?: string;
  /** Логин ответственного. Значение «-» — заявки, которые никто не ведёт. */
  owner?: string;
  form?: string;
  source?: string;
};

/** Логин, которого не бывает: им портал помечает «без ответственного». */
export const NOBODY = "-";

export const leads = (filter: LeadFilter = {}, page = 0, size = 50) => {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  for (const [key, value] of Object.entries(filter)) {
    if (value) query.set(key, value);
  }
  return get<Page<LeadRow>>(`/leads?${query}`);
};
export const leadStatuses = () => get<string[]>("/leads/statuses");
export const lead = (id: string) => get<Lead>(`/leads/${id}`);
export const triageLead = (id: string, status: string, owner: string | null) =>
  post<Lead>(`/leads/${id}/triage`, { status, owner });
export const convertLead = (id: string, form: Conversion) =>
  post<Deal>(`/leads/${id}/convert`, form);

// ————— история переписки —————
//
// Одна на заявку, клиента и сделку: запись у них одинаковая, отличается
// только тем, к чему она привязана. История дописывается и читается —
// правки и удаления в API нет, и это решение бэка, а не пробел.

export type Interaction = {
  id: string;
  dealId: string | null;
  clientId: string | null;
  leadId: string | null;
  kind: string;
  direction: string | null;
  at: string;
  subject: string | null;
  body: string;
  actor: string;
};

export type NewInteraction = {
  kind: string;
  direction: string | null;
  /** Пусто — портал поставит сейчас. Звонок записывают после разговора. */
  at: string | null;
  subject: string;
  body: string;
};

export type HistoryOf = "leads" | "clients" | "deals";

export const history = (of: HistoryOf, id: string) =>
  get<Interaction[]>(`/${of}/${id}/history`);
export const addToHistory = (of: HistoryOf, id: string, entry: NewInteraction) =>
  post<Interaction>(`/${of}/${id}/history`, entry);

// ————— клиенты —————
//
// Самые чувствительные данные портала. Размер страницы ограничен сверху
// на портале — по той же причине, что и у заявок.

export type ClientRow = {
  id: string;
  name: string;
  kind: string;
  inn: string | null;
  city: string | null;
  owner: string | null;
  /** Сколько сделок заведено по этому клиенту. */
  deals: number;
  updatedAt: string;
};

export type Client = {
  id: string;
  /** Версия карточки: уезжает обратно в форме правки, иначе `409`. */
  version: number;
  name: string;
  kind: string;
  inn: string | null;
  kpp: string | null;
  externalId: string | null;
  country: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  owner: string | null;
  createdAt: string;
  updatedAt: string;
};

// Поля формы — строки, а не `string | null`: пустое поле ввода даёт "",
// и портал принимает "" везде, где допускает пустое значение. Гонять
// туда-обратно null ради того же смысла значит писать преобразование
// в обе стороны на каждом поле.
export type ClientForm = {
  /** При создании не нужна. */
  version: number | null;
  name: string;
  kind: string;
  inn: string;
  kpp: string;
  externalId: string;
  country: string;
  city: string;
  email: string;
  phone: string;
  note: string;
  owner: string;
};

export const clients = (query: string, page = 0, size = 50) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query) params.set("query", query);
  return get<Page<ClientRow>>(`/clients?${params}`);
};
export const clientKinds = () => get<string[]>("/clients/kinds");
export const client = (id: string) => get<Client>(`/clients/${id}`);
export const createClient = (form: ClientForm) => post<Client>("/clients", form);
export const updateClient = (id: string, form: ClientForm) =>
  put<Client>(`/clients/${id}`, form);

// ————— сделки —————

export type Pipeline = {
  pipeline: string;
  stages: string[];
  /** Стадии, которыми эта воронка заканчивается успехом. */
  wonStages: string[];
  /** Стадии, которыми она заканчивается отказом: перевод в такую требует причины. */
  lostStages: string[];
};

export type DealRow = {
  id: string;
  clientId: string;
  clientName: string;
  pipeline: string;
  title: string;
  stage: string;
  amount: number | null;
  currency: string;
  productSlug: string | null;
  owner: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Attachment = {
  documentId: string;
  slug: string;
  title: string;
  attachedBy: string;
  attachedAt: string;
};

export type Deal = {
  id: string;
  version: number;
  clientId: string;
  clientName: string;
  /** Заявка, из которой заведена сделка. Пусто у заведённой руками. */
  leadId: string | null;
  pipeline: string;
  title: string;
  stage: string;
  /** Стадии этой воронки по порядку: форма рисует выбор из них. */
  stages: string[];
  /** Стадии, которыми эта воронка заканчивается успехом. */
  wonStages: string[];
  /** Стадии, которыми она заканчивается отказом: перевод в такую требует причины. */
  lostStages: string[];
  amount: number | null;
  currency: string;
  productSlug: string | null;
  owner: string | null;
  closedAt: string | null;
  lostReason: string | null;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
};

export type NewDeal = {
  clientId: string;
  pipeline: string;
  title: string;
  amount: number | null;
  currency: string;
  productSlug: string;
  owner: string;
};

export type DealForm = {
  version: number | null;
  title: string;
  amount: number | null;
  currency: string;
  productSlug: string;
  owner: string;
};

/** Разбор заявки в сделку. Пустой `clientId` — завести клиента из заявки. */
export type Conversion = {
  clientId: string | null;
  pipeline: string;
  title: string | null;
  amount: number | null;
  owner: string;
};

export const pipelines = () => get<Pipeline[]>("/deals/pipelines");
export const deals = (
  filter: { pipeline?: string; stage?: string; clientId?: string; owner?: string },
  page = 0,
  size = 50,
) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (filter.pipeline) params.set("pipeline", filter.pipeline);
  if (filter.stage) params.set("stage", filter.stage);
  if (filter.clientId) params.set("clientId", filter.clientId);
  // «-» — «без ответственного». Отдельный вопрос менеджера, а не пустой
  // фильтр: те же слова, что у заявок и разговоров.
  if (filter.owner) params.set("owner", filter.owner);
  return get<Page<DealRow>>(`/deals?${params}`);
};
export const deal = (id: string) => get<Deal>(`/deals/${id}`);
export const createDeal = (form: NewDeal) => post<Deal>("/deals", form);
export const updateDeal = (id: string, form: DealForm) => put<Deal>(`/deals/${id}`, form);
export const moveDeal = (id: string, stage: string, lostReason: string | null) =>
  post<Deal>(`/deals/${id}/stage`, { stage, lostReason });
export const attachToDeal = (id: string, documentId: string) =>
  post<Deal>(`/deals/${id}/attachments`, { documentId });
export const detachFromDeal = (id: string, documentId: string) =>
  request<Deal>(`/deals/${id}/attachments/${documentId}`, { method: "DELETE" });
export const dealQuotes = (id: string) => get<QuoteRow[]>(`/deals/${id}/quotes`);

// ————— коммерческие предложения —————
//
// Единственное место портала, где цену называет человек. Наружу — на сайт,
// в каталог, в ответы Ведалины — она не попадает никогда.

export type QuoteRow = {
  id: string;
  dealId: string;
  dealTitle: string;
  number: string;
  status: string;
  total: number | null;
  currency: string;
  validUntil: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type QuoteItem = {
  productSlug: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Считает портал: цена × количество не должна расходиться с сохранённой. */
  amount: number;
};

export type Quote = {
  id: string;
  version: number;
  dealId: string;
  dealTitle: string;
  number: string;
  status: string;
  total: number | null;
  currency: string;
  validUntil: string | null;
  note: string | null;
  items: QuoteItem[];
  sentAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoteItemForm = {
  productSlug: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type NewQuote = {
  dealId: string;
  currency: string;
  validUntil: string | null;
  note: string;
  items: QuoteItemForm[];
};

export type QuoteForm = {
  version: number | null;
  currency: string;
  validUntil: string | null;
  note: string;
  items: QuoteItemForm[];
};

export const quotes = (status: string, page = 0, size = 50) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return get<Page<QuoteRow>>(`/quotes?${params}`);
};
export const quoteStatuses = () => get<string[]>("/quotes/statuses");
export const quote = (id: string) => get<Quote>(`/quotes/${id}`);
export const createQuote = (form: NewQuote) => post<Quote>("/quotes", form);
export const updateQuote = (id: string, form: QuoteForm) => put<Quote>(`/quotes/${id}`, form);
export const sendQuote = (id: string) => post<Quote>(`/quotes/${id}/send`);
export const decideQuote = (id: string, status: string) =>
  post<Quote>(`/quotes/${id}/decision`, { status });

// ————— аналитика воронки —————
//
// Считается по заявкам, а не по сделкам: атрибуция — свойство того,
// откуда человек пришёл. Сделка, заведённая руками, в разрезы не попадает.

export type AnalyticsRow = {
  key: string;
  leads: number;
  deals: number;
  won: number;
  lost: number;
  wonAmount: number | null;
};

export type Analytics = {
  by: string;
  from: string | null;
  to: string | null;
  rows: AnalyticsRow[];
  totals: Omit<AnalyticsRow, "key">;
};

export const analyticsDimensions = () => get<string[]>("/analytics/dimensions");
export const analytics = (by: string, from: string, to: string) => {
  const params = new URLSearchParams({ by });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return get<Analytics>(`/analytics?${params}`);
};

// ————— сотрудники —————
//
// Список ответственных приходит из провайдера идентичности: в режиме
// keycloak — пользователи realm'а, в запасном local — таблица admin_user.
// Только чтение: завести человека и выдать роль — работа консоли Keycloak.

export type StaffMember = {
  login: string;
  /** Как показывать. Пусто у учётной записи без имени — тогда логин. */
  name: string | null;
  /** Отключённые остаются в списке: на них висят старые сделки. */
  enabled: boolean;
};

export const staff = () => get<StaffMember[]>("/staff");

// ————— журнал —————

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  subject: string;
  subjectId: string | null;
  correlationId: string | null;
  ip: string | null;
  payload: string | null;
};

export const audit = (filter: { subject?: string; actor?: string }, page = 0, size = 50) => {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (filter.subject) query.set("subject", filter.subject);
  if (filter.actor) query.set("actor", filter.actor);
  return get<Page<AuditEntry>>(`/audit?${query}`);
};

// ————— разговоры посетителей —————
//
// Две выборки, а не одна с фильтром. Очередь — «кому надо ответить прямо
// сейчас»: только ждущие, дольше ждущие первыми. Список — «что вообще
// происходит». Смешав их, получаем экран, где закрытые разговоры недельной
// давности стоят вперемешку с теми, кто ждёт третью минуту.

export type ChatStatus = "open" | "waiting" | "attended" | "closed";

export type ChatCard = {
  id: string;
  status: ChatStatus;
  owner: string | null;
  language: string | null;
  campaign: string | null;
  page: string | null;
  startedAt: string;
  lastAt: string;
};

export type ChatLine = {
  author: "visitor" | "assistant" | "staff";
  actor: string | null;
  body: string;
  /** Чем отвечала Ведалина. Сотруднику это важно: он видит, что уже сказали. */
  sources: { title: string; url: string; kind?: string }[];
  /** Когда прочитано посетителем. null — ещё нет. */
  readAt: string | null;
  at: string;
};

export type ChatThread = { id: string | null; status: ChatStatus; messages: ChatLine[] };

export const chatQueue = (page = 0, size = 20) =>
  get<Page<ChatCard>>(`/chats/queue?page=${page}&size=${size}`);

export const chatsAll = (owner = "", page = 0, size = 20) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (owner) params.set("owner", owner);
  return get<Page<ChatCard>>(`/chats?${params}`);
};

export const chatThread = (id: string) => get<ChatThread>(`/chats/${id}`);

/** Ответ и есть взятие разговора: сотрудник становится ответственным. */
export const replyInChat = (id: string, text: string) =>
  post<ChatThread>(`/chats/${id}/messages`, { text });

export const closeChat = (id: string) => post<void>(`/chats/${id}/close`, {});

// ————— уничтожение персональных данных —————
//
// Стирает и заявку, и разговор, из которого она выросла: человек подаёт одно
// обращение, а данные его лежат в двух местах.
export const eraseLeadData = (id: string) =>
  del<{ result: string; conversations: string }>(`/leads/${id}/personal-data`);

export const eraseClientData = (id: string) =>
  del<{ result: string }>(`/clients/${id}/personal-data`);

export const eraseChatData = (id: string) =>
  del<{ result: string }>(`/chats/${id}/personal-data`);

/** Сообщить посетителю, что сотрудник печатает. Подсказка, а не действие. */
export const pingTypingInChat = (id: string) =>
  post<void>(`/chats/${id}/typing`, {}).catch(() => {});
