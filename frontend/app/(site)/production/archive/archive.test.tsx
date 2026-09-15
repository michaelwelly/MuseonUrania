import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { photoArchive } from "@/content/photo-archive";
import ArchiveScreen from "./screen";

// Фотоархив: все кадры съёмки, превью в сетке и оригинал по нажатию.
// Молча ломается здесь то, что превью и оригинал перепутаны местами
// (сетка тянет по два мегабайта на ячейку) или кадр потерян при правке списка.

describe("фотоархив производства", () => {
  it("все 155 кадров, без повторов", () => {
    expect(photoArchive.shots).toHaveLength(155);
    expect(new Set(photoArchive.shots.map((s) => s.name)).size).toBe(155);
  });

  it("в сетке превью, ссылка — на оригинал в новой вкладке", () => {
    const { container } = render(<ArchiveScreen />);
    const grid = container.querySelector("ul");
    if (!grid) throw new Error("сетка не нарисована");

    const links = within(grid).getAllByRole("link");
    expect(links).toHaveLength(155);

    const first = photoArchive.shots[0];
    expect(links[0]).toHaveAttribute("href", expect.stringContaining(first.original));
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");

    const img = within(links[0]).getByRole("img");
    expect(img.getAttribute("src")).toContain(encodeURIComponent(first.preview));
    expect(img.getAttribute("src")).not.toContain(encodeURIComponent(first.original));
  });

  it("куда писать об использовании снимков — адрес VEDAL", () => {
    render(<ArchiveScreen />);
    expect(screen.getByRole("link", { name: "sales@vedal-med.ru" })).toHaveAttribute(
      "href",
      "mailto:sales@vedal-med.ru",
    );
  });
});
