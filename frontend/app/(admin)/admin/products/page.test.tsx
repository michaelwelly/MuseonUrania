import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Продукция: публикация тумблером, отбор, правка категорий в строке.
//
// Что здесь ломается молча.
//
// Массовая публикация. Если она пошлёт запрос на каждое выделенное изделие,
// а не только на те, у кого состояние другое, портал получит «опубликовать
// опубликованное» — и либо откажет, испортив отчёт о работе, либо примет
// и обновит дату правки у изделий, которых никто не трогал.
//
// Категории. В строке списка лежат НАЗВАНИЯ категорий, а сохранять надо
// АДРЕСА. Сопоставление по названию выглядит работающим ровно до первой
// пары одноимённых — и тогда изделие тихо переезжает в чужую категорию.
//
// Отмена публикации. Она обязана вернуть прежнее состояние каждого изделия,
// а не выключить всё подряд.

const mocks = vi.hoisted(() => ({
  products: vi.fn(),
  publishProduct: vi.fn(),
  product: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  products: mocks.products,
  publishProduct: mocks.publishProduct,
  product: mocks.product,
  updateProduct: mocks.updateProduct,
  categories: () =>
    Promise.resolve([
      { id: "c1", slug: "neonatology", name: "Неонатология", productCount: 2 },
      { id: "c2", slug: "resuscitation", name: "Реанимация", productCount: 1 },
    ]),
}));

import ProductsPage from "./page";
import { ToastHost } from "../Toast";
import { CountsHost } from "../counts";

function row(
  id: string,
  name: string,
  published: boolean,
  docStatus: string,
  imageSrc: string | null,
  categories: string[] = ["Неонатология"],
) {
  return {
    id,
    slug: "vedal-" + id,
    name,
    kind: "Инкубатор",
    summary: "Короткое описание",
    docStatus,
    published,
    sortOrder: 1,
    imageSrc,
    categories,
    updatedAt: "2026-08-12T09:00:00Z",
  };
}

const ТРИ = [
  row("r1", "VEDAL R1", true, "confirmed", "photos/products/vedal-r1.jpg"),
  row("r2", "VEDAL R2", false, "confirmed", null),
  row("t100", "VEDAL T-100", false, "pending", null, []),
];

beforeEach(() => {
  window.localStorage.clear();
  mocks.products.mockReset().mockResolvedValue(ТРИ);
  mocks.publishProduct.mockReset().mockResolvedValue({});
  mocks.updateProduct.mockReset().mockResolvedValue({});
  mocks.product.mockReset().mockResolvedValue({
    id: "r2",
    version: 4,
    slug: "vedal-r2",
    name: "VEDAL R2",
    kind: "Инкубатор",
    summary: "Короткое описание",
    detail: null,
    purpose: null,
    features: [],
    docStatus: "confirmed",
    published: false,
    sortOrder: 1,
    imageSrc: null,
    imageAlt: null,
    // Адреса, а не названия: сохранять надо их.
    categorySlugs: ["neonatology"],
    keyParams: [],
    specs: [],
    createdAt: "2026-08-01T09:00:00Z",
    updatedAt: "2026-08-12T09:00:00Z",
  });
});

const РЕДАКТОР_САЙТА = {
  actor: "production",
  roles: ["portal-production"],
  authentication: "keycloak",
};

async function экран() {
  const user = userEvent.setup();
  render(
    <ToastHost>
      {/* Счётчики спрашивают только двери своего контура, поэтому им нужна
          сессия. Здесь — та, что ведёт сайт: продукция её предмет. */}
      <CountsHost who={РЕДАКТОР_САЙТА}>
        <ProductsPage />
      </CountsHost>
    </ToastHost>,
  );
  await screen.findByText("VEDAL R1");
  return user;
}

describe("публикация тумблером", () => {
  it("тумблер показывает состояние словом, а не только положением", async () => {
    await экран();

    const строка = screen.getByText("VEDAL R1").closest("tr")!;
    // Положение тумблера — одна примета, и притом чисто зрительная.
    expect(within(строка).getByText("опубликовано")).toBeTruthy();

    const черновик = screen.getByText("VEDAL R2").closest("tr")!;
    expect(within(черновик).getByText("черновик")).toBeTruthy();
  });

  it("снятие с публикации оставляет отмену, и отмена возвращает", async () => {
    const user = await экран();

    await user.click(screen.getByRole("switch", { name: "Снять с публикации: VEDAL R1" }));
    await waitFor(() => expect(mocks.publishProduct).toHaveBeenCalledWith("r1", false));

    await user.click(await screen.findByRole("button", { name: "Отменить" }));
    await waitFor(() => expect(mocks.publishProduct).toHaveBeenCalledWith("r1", true));
  });

  it("массовая публикация трогает только те, у кого состояние другое", async () => {
    const user = await экран();

    await user.click(screen.getByLabelText("Выбрать всё: изделия"));
    await user.click(screen.getByRole("button", { name: "Опубликовать" }));

    await waitFor(() => expect(mocks.publishProduct).toHaveBeenCalledTimes(2));
    // R1 уже опубликован: запрос на него — это либо отказ, либо новая дата
    // правки у изделия, которого никто не трогал.
    expect(mocks.publishProduct).toHaveBeenCalledWith("r2", true);
    expect(mocks.publishProduct).toHaveBeenCalledWith("t100", true);
    expect(mocks.publishProduct).not.toHaveBeenCalledWith("r1", true);
  });
});

describe("отбор", () => {
  it("«Ожидают уточнения» показывает только те, у кого данные не по датащиту", async () => {
    const user = await экран();

    await user.click(screen.getByRole("button", { name: /Ожидают уточнения/ }));

    expect(screen.getByText("VEDAL T-100")).toBeTruthy();
    expect(screen.queryByText("VEDAL R1")).toBeNull();
  });

  it("счётчик у чипа считает по всему каталогу, а не по отобранному", async () => {
    const user = await экран();

    await user.click(screen.getByRole("button", { name: /Черновики/ }));

    // После отбора на экране два изделия, но «На сайте» по-прежнему одно
    // на весь каталог — иначе счётчики начнут считать сами себя.
    expect(screen.getByRole("button", { name: /На сайте/ }).textContent).toContain("1");
  });

  it("поиск идёт и по адресу, и по категории, а не только по названию", async () => {
    const user = await экран();

    await user.type(screen.getByLabelText("Поиск по каталогу"), "Реаним");
    expect(screen.queryByText("VEDAL R1")).toBeNull();

    await user.clear(screen.getByLabelText("Поиск по каталогу"));
    await user.type(screen.getByLabelText("Поиск по каталогу"), "vedal-t100");
    expect(screen.getByText("VEDAL T-100")).toBeTruthy();
  });
});

describe("что видно в строке", () => {
  it("изделие без снимка помечено, а не выглядит как изделие со снимком", async () => {
    await экран();

    const без = screen.getByText("VEDAL R2").closest("tr")!;
    expect(без.querySelector(".thumb--none")).toBeTruthy();

    const со = screen.getByText("VEDAL R1").closest("tr")!;
    expect(со.querySelector(".thumb--none")).toBeNull();
  });

  it("изделие без категории говорит это словом", async () => {
    await экран();

    const строка = screen.getByText("VEDAL T-100").closest("tr")!;
    expect(within(строка).getByText("нет категории")).toBeTruthy();
  });
});

describe("категории в строке", () => {
  it("сохраняет адреса категорий, а не их названия", async () => {
    const user = await экран();

    await user.click(screen.getByRole("button", { name: "Правка категорий: VEDAL R2" }));

    // Карточка читается целиком: в строке лежат названия, а сохранять надо
    // адреса — и заодно приезжает свежая версия, без которой будет 409.
    await waitFor(() => expect(mocks.product).toHaveBeenCalledWith("r2"));

    await user.click(await screen.findByRole("checkbox", { name: "Реанимация" }));
    await user.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() => expect(mocks.updateProduct).toHaveBeenCalled());
    const [id, form] = mocks.updateProduct.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe("r2");
    expect(form.categorySlugs).toEqual(["neonatology", "resuscitation"]);
    // Версия — из прочитанной карточки, а не из воздуха.
    expect(form.version).toBe(4);
  });

  it("отмена ничего не сохраняет", async () => {
    const user = await экран();

    await user.click(screen.getByRole("button", { name: "Правка категорий: VEDAL R2" }));
    await user.click(await screen.findByRole("checkbox", { name: "Реанимация" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(mocks.updateProduct).not.toHaveBeenCalled();
  });
});
