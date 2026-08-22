import { beforeEach, describe, expect, it, vi } from "vitest";

import { attribution, visitorKey } from "./submit";

// Атрибуция заявки: язык страницы и кампания. Два из четырёх разрезов
// аналитики CRM считаются по этим полям, и пустые они там, где посетитель
// пришёл мимо кампании, — а не там, где фронт их потерял.
describe("атрибуция заявки", () => {
  it("берёт кампанию из utm_campaign", () => {
    expect(attribution("?utm_campaign=innoprom-2026", "ru")).toEqual({
      language: "ru",
      campaign: "innoprom-2026",
    });
  });

  // Бэкенд ждёт двухбуквенный код и отобьёт «ru-RU» четырёхсотой,
  // а <html lang> на мультиязычном сайте будет именно таким.
  it("режет региональный код языка до двух букв", () => {
    expect(attribution("", "ru-RU").language).toBe("ru");
    expect(attribution("", "EN").language).toBe("en");
  });

  it("не выдумывает язык, когда его неоткуда взять", () => {
    expect(attribution("", "").language).toBeUndefined();
    expect(attribution("", "x").language).toBeUndefined();
  });

  // Заявка без кампании — обычное дело: посетитель пришёл из поиска или
  // по прямой ссылке. Пустое поле честнее выдуманного «direct».
  it("оставляет кампанию пустой, когда метки нет", () => {
    expect(attribution("?utm_source=yandex", "ru").campaign).toBeUndefined();
    expect(attribution("?utm_campaign=", "ru").campaign).toBeUndefined();
    expect(attribution("?utm_campaign=%20%20", "ru").campaign).toBeUndefined();
  });

  // Ограничение колонки — 200 символов. Заявку, отклонённую базой из-за
  // длинной метки в чужой ссылке, посетитель воспринимает как сломанный сайт.
  it("обрезает слишком длинную метку вместо отказа в приёме", () => {
    const long = "a".repeat(500);
    expect(attribution(`?utm_campaign=${long}`, "ru").campaign).toHaveLength(200);
  });

  // Остальные utm_* — профиль посетителя, а не то, что нужно CRM.
  it("не собирает ничего, кроме кампании", () => {
    const result = attribution("?utm_source=yandex&utm_medium=cpc&utm_term=ивл", "ru");
    expect(Object.keys(result).sort()).toEqual(["campaign", "language"]);
    expect(result.campaign).toBeUndefined();
  });
});

// Ключ разговора — единственное, что закрывает переписку с Ведалиной:
// кто знает ключ, тот читает чужой разговор.
describe("ключ разговора", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("переиспользует сохранённый ключ, чтобы разговор пережил перезагрузку", () => {
    localStorage.setItem("vedal.chat.visitor", "0123456789abcdef0123456789abcdef");
    expect(visitorKey()).toBe("0123456789abcdef0123456789abcdef");
  });

  // Главная проверка. randomUUID существует только в защищённом контексте,
  // а стенд ходит по http — значит на стенде работает именно эта ветка,
  // и раньше она отдавала Math.random().
  it("без randomUUID берёт случайность у getRandomValues, а не у Math.random", () => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    const dice = vi.spyOn(Math, "random");
    const bytes = vi.spyOn(crypto, "getRandomValues");
    try {
      const key = visitorKey();

      expect(key).toMatch(/^[0-9a-f]{32}$/);
      expect(bytes).toHaveBeenCalled();
      expect(dice, "Math.random не годится для секрета").not.toHaveBeenCalled();
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
  });

  it("выдаёт ключ, даже когда хранилище запрещено", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("хранилище недоступно");
    });

    expect(visitorKey()).toMatch(/^[0-9a-f-]{32,36}$/);
  });

  it("выдаёт разные ключи разным вкладкам", () => {
    const first = visitorKey();
    localStorage.clear();

    expect(visitorKey()).not.toBe(first);
  });
});
