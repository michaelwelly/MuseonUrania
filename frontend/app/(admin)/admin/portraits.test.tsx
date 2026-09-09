import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Портреты сотрудников.
//
// Проверяется не «картинка появилась», а четыре свойства кеша, каждое
// из которых ломается тихо и заметно только на живом стенде:
//
//   1. один запрос на человека, сколько бы кружков его ни показывали —
//      страница журнала показывает восемь записей подряд, и без кеша
//      её открытие стоило бы двадцати запросов за одним лицом;
//   2. пока портрета нет, стоит кружок с буквой — он не должен исчезнуть
//      ни на время загрузки, ни насовсем;
//   3. после замены кружок в шапке показывает новое лицо, а не прежнее;
//   4. отказ портала не превращается в бесконечный опрос.

const mocks = vi.hoisted(() => ({ avatarOf: vi.fn() }));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  avatarOf: mocks.avatarOf,
}));

import { Avatar } from "./Avatar";
import { contentSecurityPolicy } from "@/lib/security-headers";

import { forgetPortrait, __resetPortraits } from "./portraits";

/** Blob подделывать не нужно: кеш кладёт его в URL.createObjectURL как есть. */
const снимок = () => new Blob(["jpeg"], { type: "image/jpeg" });

beforeEach(() => {
  __resetPortraits();
  mocks.avatarOf.mockReset().mockResolvedValue(снимок());
});

afterEach(() => {
  __resetPortraits();
});

describe("кружок сотрудника", () => {
  it("показывает портрет, когда он есть", async () => {
    render(<Avatar name="Ирина Кольцова" login="i.koltsova" />);

    await waitFor(() =>
      expect(document.querySelector("img.avatar__photo")).toBeTruthy(),
    );
    expect(mocks.avatarOf).toHaveBeenCalledWith("i.koltsova");
  });

  // Портрет есть не у всех и не появится у всех. Буква — не заглушка
  // под фото, а рабочее состояние кружка.
  it("без портрета остаётся буква", async () => {
    mocks.avatarOf.mockResolvedValue(null);

    render(<Avatar name="Ирина Кольцова" login="i.koltsova" />);

    await waitFor(() => expect(mocks.avatarOf).toHaveBeenCalled());
    expect(document.querySelector("img.avatar__photo")).toBeNull();
    expect(screen.getByText("ИК")).toBeTruthy();
  });

  // У Ведалины и у портала логина нет. Спрашивать за них портрет значит
  // ходить в дверь справочника за строкой, которой там не бывает.
  it("без логина портрет не спрашивается вовсе", async () => {
    render(<Avatar name="Ведалина" tone="machine" />);

    await waitFor(() => expect(screen.getByText("В")).toBeTruthy());
    expect(mocks.avatarOf).not.toHaveBeenCalled();
  });

  // Главное свойство кеша. Восемь кружков одного человека в журнале — это
  // один запрос, а не восемь.
  it("несколько кружков одного человека — один запрос", async () => {
    render(
      <>
        <Avatar name="Ирина" login="i.koltsova" />
        <Avatar name="Ирина" login="i.koltsova" size="s" />
        <Avatar name="Ирина" login="i.koltsova" size="l" />
      </>,
    );

    await waitFor(() =>
      expect(document.querySelectorAll("img.avatar__photo")).toHaveLength(3),
    );
    expect(mocks.avatarOf).toHaveBeenCalledTimes(1);
  });

  // Без сброса кеша человек нажал бы «заменить» и не увидел результата:
  // в шапке осталось бы прежнее лицо до перезагрузки страницы.
  it("после замены кружок показывает новый портрет", async () => {
    render(<Avatar name="Ирина" login="i.koltsova" />);

    const прежний = await waitFor(() => {
      const img = document.querySelector("img.avatar__photo") as HTMLImageElement;
      expect(img).toBeTruthy();
      return img.src;
    });

    forgetPortrait("i.koltsova");

    await waitFor(() => {
      const img = document.querySelector("img.avatar__photo") as HTMLImageElement;
      expect(img?.src).not.toBe(прежний);
    });
    expect(mocks.avatarOf).toHaveBeenCalledTimes(2);
  });

  // Отказ портала запоминается как отсутствие — не потому, что это правда,
  // а потому, что иначе разбуженные неудачей кружки спрашивали бы снова,
  // и снова, и снова. Разница в кружке всё равно не выражается ничем.
  it("отказ портала не превращается в опрос по кругу", async () => {
    mocks.avatarOf.mockRejectedValue(new Error("портал не отвечает"));

    render(
      <>
        <Avatar name="Ирина" login="i.koltsova" />
        <Avatar name="Ирина" login="i.koltsova" size="s" />
      </>,
    );

    await waitFor(() => expect(mocks.avatarOf).toHaveBeenCalled());
    // Дать разосланному оповещению добежать до обоих кружков.
    await new Promise((готово) => setTimeout(готово, 20));

    expect(mocks.avatarOf).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("И")).toHaveLength(2);
  });
});

// ———————————————————————————————————————————————————————————————————————————
// Портрет и политика содержимого — одна цепочка, а не два файла
//
// Так он и потерялся 9 сентября. Файл доехал, портал собрал из него квадрат
// 256×256, сохранил, записал в журнал «поставил себе портрет» — и в кружке
// остался серый круг. Ни ошибки на экране, ни отказа в запросе: последний
// шаг, показ, гасил заголовок ответа СТРАНИЦЫ, где `img-src` перечислял
// `'self' data:` и не перечислял `blob:`.
//
// Ни один тест этого не ловил, потому что каждый из двух файлов был прав
// по отдельности: кружок честно ставил адрес в `src`, политика честно
// перечисляла разрешённые источники. Ошибка жила в шве между ними.
//
// Поэтому проверка идёт от разметки к политике, а не от строки к строке:
// берётся адрес, который кружок ДЕЙСТВИТЕЛЬНО поставил, и спрашивается,
// пустит ли его та политика, которую сайт ДЕЙСТВИТЕЛЬНО отдаёт.
describe("портрет против политики содержимого", () => {
  /** Источники из директивы `img-src`. */
  function откуда_картинки(csp: string): string[] {
    const директива = csp
      .split(";")
      .map((кусок) => кусок.trim())
      .find((кусок) => кусок.startsWith("img-src "));
    expect(директива, "в политике нет директивы img-src").toBeTruthy();
    return директива!.slice("img-src ".length).split(/\s+/);
  }

  it("политика пускает тот адрес, который кружок ставит в src", async () => {
    render(<Avatar name="Ирина Кольцова" login="i.koltsova" />);

    const адрес = await waitFor(() => {
      const img = document.querySelector("img.avatar__photo") as HTMLImageElement;
      expect(img).toBeTruthy();
      return img.src;
    });

    // Схема, а не весь адрес: `blob:` и `data:` разрешаются в политике
    // целиком схемой, и `'self'` их НЕ покрывает — оно про источник
    // (протокол + хост + порт), которого у такого адреса нет.
    const схема = new URL(адрес).protocol;
    const источники = откуда_картинки(
      contentSecurityPolicy({
        NEXT_PUBLIC_MEDIA_URL: "",
        NEXT_PUBLIC_API_URL: "",
        NEXT_PUBLIC_OIDC_ISSUER: "",
        NEXT_PUBLIC_YANDEX_METRIKA_ID: "",
      }),
    );

    expect(источники, `политика не пускает ${схема} — портрет будет невидим`)
      .toContain(схема);
  });

  // Разрешение не должно быть куплено дырой: `*` или голое `https:` пустили бы
  // заодно картинку с любого чужого адреса, а картинка — это ещё и запрос
  // наружу с адресом страницы в Referer.
  it("не пускает картинку откуда угодно", () => {
    const источники = откуда_картинки(
      contentSecurityPolicy({
        NEXT_PUBLIC_MEDIA_URL: "",
        NEXT_PUBLIC_API_URL: "",
        NEXT_PUBLIC_OIDC_ISSUER: "",
        NEXT_PUBLIC_YANDEX_METRIKA_ID: "",
      }),
    );

    expect(источники).not.toContain("*");
    expect(источники).not.toContain("https:");
    expect(источники).not.toContain("http:");
  });
});
