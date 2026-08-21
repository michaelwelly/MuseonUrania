import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Форма материала.
//
// Три вещи, которые ломаются молча.
//
// Адрес. Он собирается из заголовка сам — и обязан перестать это делать,
// как только его тронули руками. Иначе редактор, набравший `vedal-r2-obzor`
// вместо `obzor-novogo-vedal-r2`, потеряет его на следующей букве заголовка
// и не поймёт, куда он делся.
//
// Конфликт версий. Портал отбивает сохранение поверх чужой правки отказом
// 409, и на этом всё: имени того, кто правил, в отказе нет. Форма обязана
// перечитать карточку и показать НАСТОЯЩИЕ отличия — «где-то что-то
// поменялось» ставит редактора перед выбором вслепую.
//
// Готовность. Обязательное порталу отделено от желательного. Смешав их,
// форма либо не даст опубликовать материал без картинки, чего портал
// не требует, либо промолчит про дату, без которой публикация отобьётся.

// Класс отказа заводится внутри vi.hoisted: vi.mock уезжает наверх файла,
// и объявленный обычным образом класс к этому моменту ещё не создан.
const mocks = vi.hoisted(() => {
  class Отказ extends Error {
    readonly status: number;
    readonly fields?: Record<string, string>;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    Отказ,
    createNews: vi.fn(),
    updateNews: vi.fn(),
    newsItem: vi.fn(),
    publishNews: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  };
});

const Отказ = mocks.Отказ;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: vi.fn(), refresh: mocks.refresh }),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: mocks.Отказ,
  createNews: mocks.createNews,
  updateNews: mocks.updateNews,
  newsItem: mocks.newsItem,
  publishNews: mocks.publishNews,
  newsTags: () => Promise.resolve(["Производство", "Сертификация"]),
  uploadMedia: () => Promise.resolve({ path: "photos/news/x.jpg", size: 1 }),
}));

import NewsEditor from "./NewsEditor";
import { ToastHost } from "../Toast";

function материал(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    version: 3,
    slug: "pervyy-material",
    tag: "Производство",
    title: "Первый материал",
    excerpt: "Короткий анонс",
    body: "Первый абзац.\n\nВторой абзац.",
    publishedOn: "2026-08-20",
    imageSrc: null,
    imageAlt: null,
    published: false,
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-12T09:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  mocks.createNews.mockReset().mockResolvedValue(материал({ id: "n2", version: 1 }));
  mocks.updateNews.mockReset().mockResolvedValue(материал({ version: 4 }));
  mocks.newsItem.mockReset().mockResolvedValue(материал());
  mocks.publishNews.mockReset().mockResolvedValue({});
});

function форма(existing?: ReturnType<typeof материал>) {
  const user = userEvent.setup();
  render(
    <ToastHost>
      <NewsEditor existing={existing as never} />
    </ToastHost>,
  );
  return user;
}

describe("адрес из заголовка", () => {
  it("у нового материала собирается сам", async () => {
    const user = форма();

    await user.type(screen.getByLabelText("Заголовок"), "Новый инкубатор");

    expect((screen.getByLabelText("Адрес материала на сайте") as HTMLInputElement).value).toBe(
      "novyy-inkubator",
    );
  });

  it("перестаёт следовать за заголовком, как только его тронули", async () => {
    const user = форма();

    await user.type(screen.getByLabelText("Заголовок"), "Новый инкубатор");
    const адрес = screen.getByLabelText("Адрес материала на сайте") as HTMLInputElement;

    await user.clear(адрес);
    await user.type(адрес, "vedal-r2-obzor");
    await user.type(screen.getByLabelText("Заголовок"), " для роддомов");

    // Иначе набранный руками адрес пропадает на следующей букве заголовка,
    // и понять, куда он делся, неоткуда.
    expect(адрес.value).toBe("vedal-r2-obzor");
  });

  it("у уже заведённого материала за заголовком не идёт вовсе", async () => {
    const user = форма(материал());

    await user.type(screen.getByLabelText("Заголовок"), " и ещё немного");

    // Адрес уже разослан: менять его молча — оборвать чужие ссылки.
    expect((screen.getByLabelText("Адрес материала на сайте") as HTMLInputElement).value).toBe(
      "pervyy-material",
    );
  });
});

describe("готовность к публикации", () => {
  it("«Опубликовать» закрыто, пока не заполнено обязательное", async () => {
    форма();

    const кнопка = screen.getByRole("button", { name: "Опубликовать" });
    expect(кнопка).toBeDisabled();

    // И сказано, чего именно не хватает, а не просто «нельзя». Ищем
    // в чек-листе, а не по всей странице: «Дата в ленте» есть и подписью
    // поля — а там она стоит всегда, заполнена она или нет.
    const список = screen.getByRole("list");
    const пункт = within(список).getByText("Дата в ленте").closest("li")!;
    expect(пункт.className).not.toContain("check__row--on");
    expect(within(пункт).getByText(/лента сортируется/)).toBeTruthy();
  });

  it("у заполненного материала открыто", async () => {
    форма(материал());

    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled();
  });

  it("обложка желательна, но публиковать не мешает", async () => {
    форма(материал());

    // Портал обложки не требует. Требовать её здесь значило бы выдумать
    // правило и не дать опубликовать то, что портал принимает.
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled();
    expect(screen.getByText("Обложка с подписью")).toBeTruthy();
  });
});

describe("конфликт версий", () => {
  it("показывает настоящие отличия, а не «что-то поменялось»", async () => {
    mocks.updateNews.mockRejectedValue(new Отказ(409, "Материал уже изменил другой редактор."));
    mocks.newsItem.mockResolvedValue(
      материал({ version: 9, title: "Первый материал, дополненный", excerpt: "Другой анонс" }),
    );

    const user = форма(материал());
    await user.click(screen.getByRole("button", { name: "Сохранить черновик" }));

    expect(
      await screen.findByText("Пока вы правили, карточку сохранил кто-то ещё"),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Показать отличия" }));

    const таблица = await screen.findByRole("table");
    expect(within(таблица).getByText("Заголовок")).toBeTruthy();
    expect(within(таблица).getByText("Первый материал, дополненный")).toBeTruthy();
    // Совпадающие поля в отличия не попадают: иначе таблица из семи строк
    // прячет две настоящие разницы среди пяти одинаковых.
    expect(within(таблица).queryByText("Тег")).toBeNull();
  });

  it("имени того, кто правил, не выдумывает", async () => {
    mocks.updateNews.mockRejectedValue(new Отказ(409, "Материал уже изменил другой редактор."));

    const user = форма(материал());
    await user.click(screen.getByRole("button", { name: "Сохранить черновик" }));

    // В отказе есть версия, но нет имени. Правдоподобное имя рядом
    // с настоящей правкой — это выдумка в закрытом контуре.
    expect(await screen.findByText(/Портал не говорит кто/)).toBeTruthy();
  });

  it("«Взять его версию» заменяет поля на чужие", async () => {
    mocks.updateNews.mockRejectedValue(new Отказ(409, "Материал уже изменил другой редактор."));
    mocks.newsItem.mockResolvedValue(
      материал({ version: 9, title: "Первый материал, дополненный" }),
    );

    const user = форма(материал());
    await user.click(screen.getByRole("button", { name: "Сохранить черновик" }));
    await screen.findByText("Пока вы правили, карточку сохранил кто-то ещё");

    await user.click(screen.getByRole("button", { name: "Взять его версию" }));

    expect((screen.getByLabelText("Заголовок") as HTMLInputElement).value).toBe(
      "Первый материал, дополненный",
    );
  });
});

describe("сохранение", () => {
  it("второе сохранение подряд уходит с версией из ответа портала", async () => {
    const user = форма(материал());

    await user.click(screen.getByRole("button", { name: "Сохранить черновик" }));
    await waitFor(() => expect(mocks.updateNews).toHaveBeenCalledTimes(1));
    expect((mocks.updateNews.mock.calls[0][1] as { version: number }).version).toBe(3);

    await user.click(screen.getByRole("button", { name: "Сохранить черновик" }));
    await waitFor(() => expect(mocks.updateNews).toHaveBeenCalledTimes(2));
    // Ушла бы прежняя — портал отказал бы по конфликту, которого нет.
    expect((mocks.updateNews.mock.calls[1][1] as { version: number }).version).toBe(4);
  });

  it("счётчик заголовка считает до предела портала, а не до выдуманного", async () => {
    форма(материал());

    // 300 — это `@Size(max = 300)` на портале. Счётчик, показывающий предел,
    // которого нет, учит не доверять счётчикам.
    expect(screen.getByText(/из 300/)).toBeTruthy();
  });
});
