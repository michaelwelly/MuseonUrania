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
const del = (path: string) => request<void>(path, { method: "DELETE" });

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
  createdAt: string;
};

export type Lead = LeadRow & {
  message: string;
  consentVersion: string;
  consentAt: string;
  correlationId: string | null;
};

export const leads = (status: string, page = 0, size = 50) => {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) query.set("status", status);
  return get<Page<LeadRow>>(`/leads?${query}`);
};
export const leadStatuses = () => get<string[]>("/leads/statuses");
export const lead = (id: string) => get<Lead>(`/leads/${id}`);
export const triageLead = (id: string, status: string, owner: string | null) =>
  post<Lead>(`/leads/${id}/triage`, { status, owner });

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
