import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Галерея «Производства» (content/production.ts → productionMedia):
// слева площадка под ролик, справа титульный кадр площадки.
//
// Проверяется то, что ломается молча:
//
// 1. Пустой плеер, который ничего не играет. Пока ролика нет, `<video>`
//    на странице быть не должно — иначе сайт обещает то, чего нет.
// 2. Возвращённый фотоархив. Съёмку 2 сентября заказчик запретил публиковать
//    до согласования (правка 16 сентября), и ни ссылки на `/production/archive/`,
//    ни подписи «Фотоархив производства» на странице быть не должно. Ошибка
//    здесь не падает и не выглядит поломкой — она просто публикует то,
//    что публиковать нельзя.
// 3. Обещание «вернуть одной правкой»: вписали адрес в PRODUCTION_ARCHIVE_HREF —
//    ячейка сама стала ссылкой с подписью. Если разметку однажды упростят,
//    обещание умрёт молча.

async function renderGallery() {
  const { default: ProductionScreen } = await import("./screen");
  const { container } = render(<ProductionScreen />);
  const gallery = container.querySelector("ul");
  if (!gallery) throw new Error("галерея не нарисована");
  return { container, gallery };
}

afterEach(() => {
  vi.doUnmock("@/content/production");
  vi.resetModules();
});

describe("галерея производства", () => {
  it("без ролика — постер без плеера", async () => {
    const { productionMedia } = await import("@/content/production");
    expect(productionMedia.video.src).toBeNull();

    const { container, gallery } = await renderGallery();

    expect(container.querySelector("video")).toBeNull();
    expect(within(gallery).getByAltText(productionMedia.video.title)).toBeInTheDocument();
  });

  it("справа титульный кадр площадки, и это не ссылка", async () => {
    const { productionMedia } = await import("@/content/production");

    const { gallery } = await renderGallery();

    expect(within(gallery).getByAltText(productionMedia.cover.alt)).toBeInTheDocument();
    expect(within(gallery).queryAllByRole("link")).toHaveLength(0);
    expect(within(gallery).queryByText("→")).toBeNull();
  });

  it("фотоархива на странице нет: ни ссылки, ни подписи", async () => {
    const { container } = await renderGallery();

    expect(container.querySelector('a[href*="/production/archive"]')).toBeNull();
    expect(container.textContent).not.toContain("Фотоархив");
    expect(container.textContent).not.toContain("155");
    // Подзаголовок обещает ровно то, что на странице осталось: блок
    // с маркировочным знаком убран той же правкой, и звать к нему нечем.
    expect(container.textContent).not.toContain("аркиров");
  });

  it("вписали адрес архива — ячейка сама стала ссылкой с подписью", async () => {
    vi.doMock("@/content/production", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/content/production")>();
      return {
        ...actual,
        productionMedia: {
          ...actual.productionMedia,
          cover: { ...actual.productionMedia.cover, href: "/production/archive/" },
        },
      };
    });

    const { productionMedia } = await import("@/content/production");
    const { gallery } = await renderGallery();

    const link = within(gallery).getByRole("link");
    // Слэш на конце добавляет trailingSlash из next.config.ts — в тестах его нет.
    expect(link.getAttribute("href")).toMatch(/^\/production\/archive\/?$/);
    expect(link).not.toHaveAttribute("target");
    expect(within(link).getByText(productionMedia.cover.label)).toBeInTheDocument();
  });

  it("вписали ролик — плеер не грузится заранее", async () => {
    vi.doMock("@/content/production", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/content/production")>();
      return {
        ...actual,
        productionMedia: {
          ...actual.productionMedia,
          video: { ...actual.productionMedia.video, src: "/photos/production/video.mp4" },
        },
      };
    });

    const { container } = await renderGallery();

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("preload", "none");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("aria-label", "Производственная площадка VEDAL");
  });
});
