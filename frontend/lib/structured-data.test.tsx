import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saved = { site: process.env.NEXT_PUBLIC_SITE_URL, api: process.env.NEXT_PUBLIC_API_URL };

beforeEach(() => {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
});

afterEach(() => {
  if (saved.site === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = saved.site;
  }

  if (saved.api === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = saved.api;
  }
});

describe("структурированные данные", () => {
  it("не отдает schema.org без боевого адреса", async () => {
    const { JsonLd, organizationStructuredData } = await import("./structured-data");

    const { container } = render(
      <JsonLd id="organization" data={organizationStructuredData()} />,
    );

    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it("рендерит JSON-LD и экранирует HTML-опасные символы", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const { JsonLd } = await import("./structured-data");

    const { container } = render(
      <JsonLd id="probe" data={{ "@context": "https://schema.org", name: "<VEDAL>" }} />,
    );

    const script = container.querySelector("#probe");
    expect(script?.textContent).toContain("\\u003cVEDAL>");
    expect(() => JSON.parse(script?.textContent ?? "")).not.toThrow();
  });

  it("собирает Organization и WebSite на боевом домене", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru/";
    const { organizationStructuredData, websiteStructuredData } = await import("./structured-data");

    const organization = organizationStructuredData() as Record<string, unknown>;
    const website = websiteStructuredData() as Record<string, unknown>;

    expect(organization["@id"]).toBe("https://vedal-med.ru/#organization");
    expect(organization.url).toBe("https://vedal-med.ru");
    expect(organization.logo).toBe("https://vedal-med.ru/brand/vedal-logo.png");
    expect(website.publisher).toEqual({ "@id": "https://vedal-med.ru/#organization" });
    expect(website.inLanguage).toBe("ru-RU");
  });

  it("собирает хлебные крошки с абсолютными адресами", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const { breadcrumbStructuredData } = await import("./structured-data");

    const data = breadcrumbStructuredData(
      [{ label: "Главная", href: "/" }, { label: "Сервис" }],
      "/service/",
    ) as { itemListElement: { position: number; name: string; item: string }[] };

    expect(data.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Главная", item: "https://vedal-med.ru/" },
      { "@type": "ListItem", position: 2, name: "Сервис", item: "https://vedal-med.ru/service/" },
    ]);
  });

  it("собирает Product без выдуманных цен и наличия", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://vedal-med.ru";
    const { productStructuredData } = await import("./structured-data");

    const data = productStructuredData(
      {
        slug: "vedal-r1",
        name: "VEDAL R1",
        kind: "Открытая реанимационная система",
        categories: ["Реанимация"],
        status: "confirmed",
        summary: "Лучистый обогрев и мониторинг.",
      },
      "/photos/products/r1.jpg",
    ) as Record<string, unknown>;

    expect(data["@type"]).toBe("Product");
    expect(data.url).toBe("https://vedal-med.ru/products/vedal-r1/");
    expect(data.image).toEqual(["https://vedal-med.ru/photos/products/r1.jpg"]);
    expect(data).not.toHaveProperty("offers");
    expect(data).not.toHaveProperty("aggregateRating");
  });
});
