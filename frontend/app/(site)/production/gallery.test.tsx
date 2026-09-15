import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Плеер и плитка фотоархива на «Производстве» (content/production.ts →
// productionMedia).
//
// Проверяется то, что ломается молча: пустой плеер, который ничего не
// играет, и плитка-ссылка без адреса. Пока ролика и ссылки нет, на странице
// не должно быть ни того, ни другого — иначе сайт обещает то, чего нет.

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
  it("без ролика — постер без плеера, без ссылки — плитка без ссылки", async () => {
    const { productionMedia } = await import("@/content/production");
    expect(productionMedia.video.src).toBeNull();
    expect(productionMedia.archive.href).toBeNull();

    const { container, gallery } = await renderGallery();

    expect(container.querySelector("video")).toBeNull();
    expect(within(gallery).getByAltText(productionMedia.video.title)).toBeInTheDocument();

    const tile = within(gallery).getByText(productionMedia.archive.label);
    expect(tile.closest("a")).toBeNull();
    expect(within(gallery).queryAllByRole("link")).toHaveLength(0);
    expect(within(gallery).queryByText("↗")).toBeNull();
  });

  it("вписали ролик и ссылку — плеер не грузится заранее, архив в новой вкладке", async () => {
    vi.doMock("@/content/production", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/content/production")>();
      return {
        ...actual,
        productionMedia: {
          video: { ...actual.productionMedia.video, src: "/photos/production/video.mp4" },
          archive: { ...actual.productionMedia.archive, href: "https://example.org/archive" },
        },
      };
    });

    const { container, gallery } = await renderGallery();

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("preload", "none");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("aria-label", "Производственная площадка VEDAL");

    const link = within(gallery).getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.org/archive");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("(откроется в новой вкладке)", { exact: false })).toBeInTheDocument();
  });
});
