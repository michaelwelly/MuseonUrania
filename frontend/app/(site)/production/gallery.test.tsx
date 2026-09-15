import { render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Плеер и плитка фотоархива на «Производстве» (content/production.ts →
// productionMedia).
//
// Проверяется то, что ломается молча: пустой плеер, который ничего не
// играет, и плитка-ссылка без адреса. Пока ролика нет, плеера на странице
// быть не должно — иначе сайт обещает то, чего нет.

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
  it("без ролика — постер без плеера, плитка ведёт на свою страницу архива", async () => {
    const { productionMedia } = await import("@/content/production");
    expect(productionMedia.video.src).toBeNull();

    const { container, gallery } = await renderGallery();

    expect(container.querySelector("video")).toBeNull();
    expect(within(gallery).getByAltText(productionMedia.video.title)).toBeInTheDocument();

    const link = within(gallery).getByRole("link");
    // Слэш на конце добавляет trailingSlash из next.config.ts — в тестах его нет.
    expect(link.getAttribute("href")).toMatch(/^\/production\/archive\/?$/);
    expect(link).not.toHaveAttribute("target");
    expect(within(link).getByText(productionMedia.archive.label)).toBeInTheDocument();
  });

  it("без адреса архива плитка без ссылки и без стрелки", async () => {
    vi.doMock("@/content/production", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/content/production")>();
      return {
        ...actual,
        productionMedia: { ...actual.productionMedia, archive: { ...actual.productionMedia.archive, href: null } },
      };
    });

    const { gallery } = await renderGallery();

    expect(within(gallery).queryAllByRole("link")).toHaveLength(0);
    expect(within(gallery).queryByText("→")).toBeNull();
  });

  it("вписали ролик — плеер не грузится заранее", async () => {
    vi.doMock("@/content/production", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/content/production")>();
      return {
        ...actual,
        productionMedia: {
          video: { ...actual.productionMedia.video, src: "/photos/production/video.mp4" },
          archive: actual.productionMedia.archive,
        },
      };
    });

    const { container, gallery } = await renderGallery();

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("preload", "none");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("aria-label", "Производственная площадка VEDAL");
  });
});
