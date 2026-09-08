import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Согласие — единственное, что стоит между посетителем и передачей данных
// в Яндекс. Ошибка здесь не ломает страницу и ничем себя не выдаёт:
// счётчик просто начинает работать у того, кто его не разрешал.
describe("согласие на аналитику", () => {
  const saved = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
    localStorage.clear();
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
    else process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID = saved;
  });

  // Номер счётчика читается на импорте модуля, поэтому переменную окружения
  // ставим до него, а сам импорт делаем заново в каждом тесте.
  const isolated = async () => {
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID = "12345678";
    return import("./consent");
  };

  describe("площадка без счётчика", () => {
    it("до ответа плашку показывает", async () => {
      const { readConsent } = await import("./consent");

      expect(readConsent()).toBe("unanswered");
    });

    it("после «Понятно» плашку больше не показывает", async () => {
      const { acknowledge, readConsent } = await import("./consent");

      acknowledge();

      expect(readConsent()).toBe("necessary");
    });

    it("«Понятно» не записывает ответ про аналитику", async () => {
      const { acknowledge } = await import("./consent");

      acknowledge();

      // Записать сюда «granted» значило бы включить счётчик тому,
      // кого о счётчике не спрашивали.
      expect(localStorage.getItem("vedal.analytics.v1")).toBeNull();
    });
  });

  describe("площадка со счётчиком", () => {
    it("до ответа не считается согласием", async () => {
      const { readConsent } = await isolated();

      expect(readConsent()).toBe("unanswered");
    });

    it("старое «Понятно» ответом про аналитику не считается", async () => {
      // Человек нажал «Понятно» на плашке, где выбора не было: тогда
      // передавать было нечего и некому. Счётчик появился позже, и вопрос
      // ему обязаны задать заново.
      localStorage.setItem("vedal.cookies.v1", "2026-01-01T00:00:00.000Z");
      const { readConsent } = await isolated();

      expect(readConsent()).toBe("unanswered");
    });

    it("«Принять» разрешает счётчик", async () => {
      const { answer, readConsent } = await isolated();

      answer(true);

      expect(readConsent()).toBe("analytics");
    });

    it("«Только необходимые» счётчик не разрешает", async () => {
      const { answer, readConsent } = await isolated();

      answer(false);

      expect(readConsent()).toBe("necessary");
    });

    it("отказ переживает возврат на сайт", async () => {
      const { answer } = await isolated();
      answer(false);

      vi.resetModules();
      const { readConsent } = await isolated();

      expect(readConsent()).toBe("necessary");
    });
  });

  it("недоступное хранилище согласием не считает", async () => {
    const { readConsent } = await isolated();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("приватный режим");
    });

    // Плашки в этом режиме нет — ответ сохранить некуда, и она возвращалась
    // бы на каждой странице. Но молчание согласием не становится: «unknown»
    // счётчик не поднимает.
    expect(readConsent()).toBe("unknown");
  });

  it("будит подписчиков в своей же вкладке", async () => {
    const { answer, subscribe } = await isolated();
    const notify = vi.fn();
    subscribe(notify);

    answer(true);

    // Событие storage в своей вкладке не срабатывает: без собственного
    // оповещения нажатие «Принять» не убрало бы плашку и не подняло счётчик.
    expect(notify).toHaveBeenCalled();
  });
});
