import { describe, expect, it } from "vitest";
import {
  DOCUMENT_TOPIC,
  LEAD_ANCHOR,
  SERVICE_HREF,
  isTopic,
  leadHref,
  readProduct,
  readTopic,
} from "@/lib/lead-link";

// Ссылка «кнопка → форма с выбранной темой».
//
// Проверяется то, что ломается молча. Кнопка с опечаткой в теме выглядит
// исправной: она открывает форму, форма открывается с темой по умолчанию,
// и человек отправляет запрос КП там, где просил документ. Заметит это
// менеджер в админке, через день и не поняв почему.
//
// Вторая половина — про доверие к адресу. Он приходит из чужой ссылки,
// старой закладки или строки браузера, и значение оттуда в форму попадать
// не должно, пока его не сверили со списком.

describe("адрес формы с выбранной темой", () => {
  it("несёт тему и якорь до самой формы", () => {
    const адрес = new URL(leadHref("quote"), "http://vedal.test");

    expect(адрес.pathname).toBe("/contacts/");
    expect(адрес.searchParams.get("topic")).toBe("quote");
    // Без якоря кнопка приводит на верх страницы, и форму человек ищет сам.
    expect(адрес.hash).toBe(`#${LEAD_ANCHOR}`);
  });

  it("несёт изделие, когда запрос про конкретное изделие", () => {
    const адрес = new URL(leadHref(DOCUMENT_TOPIC, "vedal-r1"), "http://vedal.test");

    expect(адрес.searchParams.get("topic")).toBe("catalog");
    expect(адрес.searchParams.get("product")).toBe("vedal-r1");
  });

  // Документ, не привязанный к изделию (лицензия компании, декларация
  // на всё), не имеет права подставить в заявку никакое изделие.
  it("без изделия параметра нет вовсе", () => {
    const адрес = new URL(leadHref(DOCUMENT_TOPIC, null), "http://vedal.test");

    expect(адрес.searchParams.has("product")).toBe(false);
  });

  it("сервисная заявка ведёт к форме сервиса, а не на верх страницы", () => {
    expect(SERVICE_HREF).toBe(`/service/#${LEAD_ANCHOR}`);
  });
});

describe("чтение адреса, пришедшего снаружи", () => {
  it("узнаёт коды тем, которые примет бэкенд", () => {
    expect(readTopic("?topic=service")).toBe("service");
    expect(readTopic("?topic=partner&utm_campaign=innoprom")).toBe("partner");
  });

  // Ровно те три случая, ради которых проверка и написана: чужая ссылка,
  // опечатка и адрес без параметра. Ни один не должен становиться темой.
  it("неизвестное, пустое и отсутствующее одинаково значат «нет темы»", () => {
    expect(readTopic("?topic=консультация")).toBeNull();
    expect(readTopic("?topic=")).toBeNull();
    expect(readTopic("")).toBeNull();
    expect(isTopic("Quote"), "коды чувствительны к регистру").toBe(false);
  });

  it("изделие читается как есть, но существование его не подтверждает", () => {
    expect(readProduct("?product=vedal-r1")).toBe("vedal-r1");
    expect(readProduct("?product=%20%20")).toBeNull();
    expect(readProduct("?topic=quote")).toBeNull();
  });
});
