import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Публикации в СМИ на странице новостей.
//
// Проверяется то, что ломается молча: ссылка на чужой сайт без noopener
// отдаёт стороннему окну доступ к нашей вкладке, а публикация без ссылки
// на источник превращается в утверждение, которое нечем подтвердить.

vi.mock("@/lib/api", () => ({ fetchNews: async () => [] }));
vi.mock("./subscribe", () => ({ default: () => null }));

describe("публикации в СМИ", () => {
  it("каждая ведёт на источник в новой вкладке и безопасно", async () => {
    const { pressMentions } = await import("@/content/news");
    const { default: NewsScreen } = await import("./screen");
    render(await NewsScreen());

    const block = screen.getByRole("region", { name: "Публикации в СМИ" });
    const links = within(block).getAllByRole("link");

    expect(links).toHaveLength(pressMentions.length);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });

  it("идут от свежих к старым", async () => {
    const { pressMentions } = await import("@/content/news");
    const dates = pressMentions.map((m) => m.isoDate);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
