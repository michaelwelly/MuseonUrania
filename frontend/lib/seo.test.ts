import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Метаданные ломаются молча: забытый canonical или og:url с чужим адресом
// не роняют ни сборку, ни страницу — их видно только в чужой ленте
// и в выдаче поисковика, то есть через недели.
describe("метаданные страницы", () => {
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

  it("ставит canonical со слэшем на конце", async () => {
    const { pageMetadata } = await import("./seo");

    const meta = pageMetadata({ title: "Сервис — VEDAL", description: "текст", path: "/service/" });

    // В next.config стоит trailingSlash, и адрес без слэша отдаёт 308.
    // Canonical, указывающий на редирект, — это canonical в никуда.
    expect(meta.alternates?.canonical).toBe("/service/");
  });

  it("собирает Open Graph с именем сайта и языком", async () => {
    const { pageMetadata } = await import("./seo");

    const og = pageMetadata({ title: "Сервис — VEDAL", description: "текст", path: "/service/" })
      .openGraph as Record<string, unknown>;

    expect(og.siteName).toBe("VEDAL");
    expect(og.locale).toBe("ru_RU");
    expect(og.url).toBe("/service/");
    expect(og.title).toBe("Сервис — VEDAL");
  });

  it("без своей картинки берёт карточку сайта и широкий формат", async () => {
    const { pageMetadata } = await import("./seo");

    const meta = pageMetadata({ title: "т", description: "о", path: "/" });

    // Раньше здесь стояло квадратное дерево 512×512 и тип `summary`:
    // своей карточки у сайта не было. Теперь есть, и она широкая —
    // 1200×630, как и ждут мессенджеры.
    expect((meta.openGraph as { images: { url: string }[] }).images[0].url)
      .toBe("/brand/og-cover.png");
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
  });

  it("со своей картинкой берёт широкую карточку", async () => {
    const { pageMetadata } = await import("./seo");

    const meta = pageMetadata({
      title: "т", description: "о", path: "/products/vedal-r1/",
      image: { url: "http://media/photos/products/vedal-r1.jpg", alt: "VEDAL R1" },
    });

    expect((meta.openGraph as { images: { url: string }[] }).images[0].url)
      .toBe("http://media/photos/products/vedal-r1.jpg");
    expect((meta.twitter as { card: string }).card).toBe("summary_large_image");
  });

  it("адрес сайта берётся из своей переменной", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru/";
    process.env.NEXT_PUBLIC_API_URL = "https://api.vedal-med.ru";
    const { siteUrl } = await import("./seo");

    // Завершающий слэш срезается: иначе абсолютные адреса выйдут с двойным.
    expect(siteUrl).toBe("https://vedal-med.ru");
  });

  it("пока адрес сайта не задан, берётся адрес API — сегодня это один шлюз", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://vedal-med.ru";
    const { siteUrl } = await import("./seo");

    expect(siteUrl).toBe("https://vedal-med.ru");
  });

  // Режим вёрстки без бэкенда. Подставить сюда localhost значило бы выкатить
  // его в разметку и увести поисковик на несуществующий адрес.
  it("без обеих переменных адреса нет, а не localhost", async () => {
    const { siteUrl } = await import("./seo");

    expect(siteUrl).toBe("");
  });
});
