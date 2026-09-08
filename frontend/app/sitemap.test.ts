import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Карта сайта и robots.txt — две вещи, которые никто не открывает руками,
// а последствия у них недельные: закрытый от обхода боевой сайт и открытый
// для обхода стенд одинаково незаметны в тот день, когда их выкатили.

vi.mock("@/lib/api", () => ({
  fetchProducts: vi.fn(async () => [{ slug: "vedal-r1" }, { slug: "vedal-a-2000" }]),
  fetchNews: vi.fn(async () => [{ slug: "innoprom-2026" }, { slug: "" }]),
}));

const saved = { site: process.env.NEXT_PUBLIC_SITE_URL, api: process.env.NEXT_PUBLIC_API_URL };

beforeEach(() => {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
});

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = saved.site;
  process.env.NEXT_PUBLIC_API_URL = saved.api;
});

describe("robots.txt", () => {
  // Главное правило. Стенд отвечает по адресу-числу, содержимое там черновое,
  // и в выдаче ему делать нечего — а найдёт его поисковик сам.
  it("без боевого адреса закрывает сайт от обхода целиком", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://51.250.31.97:18080";
    const robots = (await import("./robots")).default;

    const rules = robots().rules;

    expect(rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    expect(robots().sitemap).toBeUndefined();
  });

  it("на боевом адресе открывает сайт, кроме админки и дверей API", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const robots = (await import("./robots")).default;

    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/admin/", "/api/"]);
    expect(result.sitemap).toBe("https://vedal-med.ru/sitemap.xml");
  });
});

describe("карта сайта", () => {
  it("без боевого адреса не выдаётся вовсе", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://51.250.31.97:18080";
    const sitemap = (await import("./sitemap")).default;

    // Не «карта с адресом стенда», а пустая: адреса в карте абсолютные,
    // и единственный, который тут можно назвать, — это адрес стенда.
    expect(await sitemap()).toEqual([]);
  });

  it("собирает страницы, карточки изделий и новости из портала", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const sitemap = (await import("./sitemap")).default;

    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain("https://vedal-med.ru/");
    expect(urls).toContain("https://vedal-med.ru/products/");
    expect(urls).toContain("https://vedal-med.ru/products/vedal-r1/");
    expect(urls).toContain("https://vedal-med.ru/news/innoprom-2026/");
  });

  it("все адреса со слэшем на конце — иначе обходчик ходит через 308", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const sitemap = (await import("./sitemap")).default;

    for (const entry of await sitemap()) {
      expect(entry.url.endsWith("/")).toBe(true);
    }
  });

  // Материал без slug'а приезжает в режиме вёрстки без бэкенда. Адрес
  // `/news//` вёл бы обходчика в никуда.
  it("пропускает записи без адреса", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const sitemap = (await import("./sitemap")).default;

    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).not.toContain("https://vedal-med.ru/news//");
  });

  it("называет все три языковые версии каждой страницы", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const sitemap = (await import("./sitemap")).default;

    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain("https://vedal-med.ru/en/products/");
    expect(urls).toContain("https://vedal-med.ru/zh/products/");
    // Карточки изделий и новостей тоже: они существуют на всех трёх языках.
    expect(urls).toContain("https://vedal-med.ru/en/products/vedal-r1/");
    expect(urls).toContain("https://vedal-med.ru/zh/news/innoprom-2026/");
    // Русская версия остаётся без префикса — `/ru/` не существует.
    expect(urls).not.toContain("https://vedal-med.ru/ru/products/");
  });

  // Без hreflang три адреса с одинаковым смыслом читаются как дубли,
  // и переведённые версии выпадают из выдачи.
  it("у каждой записи стоят ссылки на остальные языки", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const sitemap = (await import("./sitemap")).default;

    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.alternates?.languages, entry.url).toBeDefined();
    }

    const home = entries.find((e) => e.url === "https://vedal-med.ru/en/");
    expect(home?.alternates?.languages).toEqual({
      ru: "https://vedal-med.ru/",
      en: "https://vedal-med.ru/en/",
      "zh-Hans": "https://vedal-med.ru/zh/",
      "x-default": "https://vedal-med.ru/",
    });
  });

  // Портал недоступен на сборке — карта обязана остаться: девять страниц
  // без каталога лучше, чем пустой файл, который читается как «сайта нет».
  it("переживает отказ портала и оставляет статические страницы", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const api = await import("@/lib/api");
    vi.mocked(api.fetchProducts).mockRejectedValueOnce(new Error("портал молчит"));
    vi.mocked(api.fetchNews).mockRejectedValueOnce(new Error("портал молчит"));

    const sitemap = (await import("./sitemap")).default;
    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain("https://vedal-med.ru/");
    expect(urls).not.toContain("https://vedal-med.ru/products/vedal-r1/");
  });
});
