import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ключ ресурса в адресе публичного API.
//
// Сегмент маршрута приезжает из Next уже процентно-закодированным, и повторное
// кодирование уводит запрос не туда. На латинских slug это незаметно —
// экранировать нечего, — поэтому ошибка жила незамеченной: видно её только
// на кириллическом адресе, где страница падала пятисотой вместо «не найдено».
describe("адрес запроса к публичному API", () => {
  const original = process.env.VEDAL_API_INTERNAL_URL;

  beforeEach(() => {
    process.env.VEDAL_API_INTERNAL_URL = "http://portal:8081";
    vi.resetModules();
  });

  afterEach(() => {
    process.env.VEDAL_API_INTERNAL_URL = original;
    vi.unstubAllGlobals();
  });

  async function requestedUrlFor(fetchOne: (slug: string) => Promise<unknown>, slug: string) {
    const calls = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", calls);

    await fetchOne(slug);

    return String(calls.mock.calls[0][0]);
  }

  it("не кодирует закодированный сегмент повторно", async () => {
    const { fetchProduct } = await import("./api");

    // %D0%BD%D0%B5%D1%82 — это «нет». Повторное кодирование давало
    // %25D0%25BD%25D0%25B5%25D1%2582, и портал отвечал четырёхсотой.
    expect(await requestedUrlFor(fetchProduct, "%D0%BD%D0%B5%D1%82"))
      .toBe("http://portal:8081/api/public/v1/products/%D0%BD%D0%B5%D1%82");
  });

  it("так же ведёт себя с новостями", async () => {
    const { fetchNewsEntry } = await import("./api");

    expect(await requestedUrlFor(fetchNewsEntry, "%D0%BD%D0%B5%D1%82"))
      .toBe("http://portal:8081/api/public/v1/news/%D0%BD%D0%B5%D1%82");
  });

  it("латинский ключ остаётся собой", async () => {
    const { fetchProduct } = await import("./api");

    expect(await requestedUrlFor(fetchProduct, "vedal-r1"))
      .toBe("http://portal:8081/api/public/v1/products/vedal-r1");
  });

  // Ссылка в cp1251 или забредший бот. decodeURIComponent на такой
  // последовательности бросает — уронить страницу это не должно.
  it("не падает на некорректной процентной последовательности", async () => {
    const { fetchProduct } = await import("./api");

    const url = await requestedUrlFor(fetchProduct, "%ED%E5%F2");

    expect(url).toContain("/api/public/v1/products/");
    expect(url, "битые байты не уходят в адрес сырыми").not.toContain("%ED");
  });

  // Ключ, у которого нет ни одной процентной последовательности, но есть
  // символы, требующие экранирования.
  it("экранирует ключ, пришедший в разобранном виде", async () => {
    const { fetchProduct } = await import("./api");

    expect(await requestedUrlFor(fetchProduct, "нет"))
      .toBe("http://portal:8081/api/public/v1/products/%D0%BD%D0%B5%D1%82");
  });
});
