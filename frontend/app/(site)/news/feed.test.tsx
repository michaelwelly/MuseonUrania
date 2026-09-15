import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tags, tagFiltersEnabled } from "@/content/news";
import NewsFeed from "./feed";

// Вкладки рубрик над лентой. Пока выключены решением заказчика — остаётся
// одна «Все»: вкладка рубрики без новостей открывала бы пустую ленту.
describe("вкладки рубрик", () => {
  it("при выключенном переключателе — только «Все»", () => {
    expect(tagFiltersEnabled).toBe(false);
    render(<NewsFeed news={[]} />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    for (const tag of tags) {
      expect(screen.queryByRole("button", { name: tag })).toBeNull();
    }
  });
});
