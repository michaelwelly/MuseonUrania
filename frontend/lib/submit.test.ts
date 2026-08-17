import { describe, expect, it } from "vitest";

import { attribution } from "./submit";

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
