import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { tags, tagFiltersEnabled } from "@/content/news";
import type { NewsItem } from "@/lib/api";
import NewsFeed from "./feed";

// Переключатель рубрик над лентой. Выключен решением заказчика — ряда нет
// вовсе, включая «Все»: одна кнопка ничего не переключает и выглядит как
// недоделка. Механика при этом жива, и проверяются обе стороны флага:
// иначе «вкладки скрыты» и «фильтр сломан» на экране неразличимы.

const запись = (tag: NewsItem["tag"], title: string): NewsItem => ({
  slug: title,
  date: "16 сентября 2026",
  tag,
  title,
  excerpt: "",
});

describe("вкладки рубрик", () => {
  it("при выключенном переключателе ряда нет совсем", () => {
    expect(tagFiltersEnabled).toBe(false);
    render(<NewsFeed news={[]} />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    for (const tag of tags) {
      expect(screen.queryByRole("button", { name: tag })).toBeNull();
    }
  });

  it("выключенный переключатель показывает все новости подряд", () => {
    render(<NewsFeed news={[запись("Продукция", "Изделие"), запись("Сервис", "Выезд")]} />);

    expect(screen.getByRole("heading", { name: "Изделие" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Выезд" })).toBeInTheDocument();
  });

  it("включённый переключатель возвращает «Все» и рубрики", () => {
    render(<NewsFeed news={[]} filtersEnabled />);

    expect(screen.getByRole("button", { name: "Все" })).toBeInTheDocument();
    for (const tag of tags) {
      expect(screen.getByRole("button", { name: tag })).toBeInTheDocument();
    }
  });

  it("включённый переключатель отбирает ленту по рубрике", async () => {
    render(
      <NewsFeed news={[запись("Продукция", "Изделие"), запись("Сервис", "Выезд")]} filtersEnabled />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Сервис" }));

    expect(screen.queryByRole("heading", { name: "Изделие" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Выезд" })).toBeInTheDocument();
  });
});
