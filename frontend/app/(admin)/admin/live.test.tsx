import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveHost } from "./live";

// Поток разговоров переоткрывается сам — и вот это «сам» проверяется здесь.
//
// Цена ошибки не в пропущенном событии. Цикл переподключения без паузы
// не отваливается и не пишет в журнал: он крутится, пока открыта вкладка,
// и съедает её. Сотрудник видит замерший интерфейс и не знает, почему.
//
// Поймано вживую: дверь ответила 200, но телом отдала не поток, а сразу
// конец. Признаком удачи тогда служил сам факт открытия, поэтому попытка
// засчитывалась успешной, пауза не бралась — и следующая начиналась в тот
// же миг.

vi.mock("@/lib/auth", () => ({
  accessToken: async () => "token",
}));

vi.mock("@/lib/submit", () => ({
  apiUrl: "http://portal.test",
}));

/** Тело, которое заканчивается сразу: ни одного куска, только конец. */
function пустоеТело() {
  return {
    getReader: () => ({
      read: async () => ({ done: true, value: undefined }),
    }),
  };
}

/**
 * Дверь, отвечающая 200 без потока, со счётчиком и потолком.
 *
 * Потолок здесь не украшение. Без него цикл переподключения без паузы
 * не даёт тесту упасть — он вешает процесс проверки целиком, и вместо
 * «столько-то вместо одного» видно «worker exited unexpectedly». Поломка
 * поймана, но её название потеряно, а читать такой отчёт будет человек.
 */
function дверьБезПотока(потолок = 50) {
  let счёт = 0;
  return vi.fn(() => {
    // Достигнутый потолок означает, что пауза не берётся. Здесь нельзя ни
    // бросить ошибку, ни вернуть отказ: и то и другое цикл разбирает своим
    // catch и идёт на следующий круг, а круг без паузы — это бесконечная
    // очередь микрозадач. Таймеры до неё не доходят, проверка не получает
    // управления и умирает вместе с процессом: вместо «открыто 50 раз
    // вместо одного» человек читает «worker exited unexpectedly».
    //
    // Поэтому цикл здесь останавливают ожиданием, которое не кончится:
    // микроочередь пустеет, часы идут, проверка досчитывает и падает
    // с названием поломки.
    if (счёт++ >= потолок) return new Promise<never>(() => {});
    return Promise.resolve({ ok: true, body: пустоеТело() });
  });
}

/** Тело, которое молчит, пока его не отпустят: живой поток без событий. */
function молчащееТело(отпустить: { сейчас?: () => void }) {
  return {
    getReader: () => ({
      read: () =>
        new Promise<{ done: boolean; value: undefined }>((resolve) => {
          отпустить.сейчас = () => resolve({ done: true, value: undefined });
        }),
    }),
  };
}

describe("поток разговоров в админке", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("не открывает дверь без остановки, когда та отвечает 200 без потока", async () => {
    const fetch = дверьБезПотока();
    vi.stubGlobal("fetch", fetch);

    render(
      <LiveHost>
        <div />
      </LiveHost>,
    );

    // Дать циклу дойти до конца первой попытки: открытие, чтение, разбор.
    await vi.advanceTimersByTimeAsync(0);
    const послеПервой = fetch.mock.calls.length;

    // И ещё раз, не двигая часы дальше паузы. Без паузы цикл успел бы
    // за это время открыть дверь ещё много раз.
    await vi.advanceTimersByTimeAsync(0);

    expect(fetch.mock.calls.length).toBe(послеПервой);
    expect(послеПервой).toBeLessThanOrEqual(2);
  });

  it("переоткрывает дверь после паузы, а не бросает попытки", async () => {
    const fetch = дверьБезПотока();
    vi.stubGlobal("fetch", fetch);

    render(
      <LiveHost>
        <div />
      </LiveHost>,
    );

    await vi.advanceTimersByTimeAsync(0);
    const доПаузы = fetch.mock.calls.length;

    // Пауза первой попытки — секунда. Пережидаем её с запасом.
    await vi.advanceTimersByTimeAsync(1500);

    expect(fetch.mock.calls.length).toBeGreaterThan(доПаузы);
  });

  it("переоткрывает сразу поток, проживший своё, — молчание не отказ", async () => {
    const отпустить: { сейчас?: () => void } = {};
    const fetch = vi.fn(async () => ({ ok: true, body: молчащееТело(отпустить) }));
    vi.stubGlobal("fetch", fetch);

    render(
      <LiveHost>
        <div />
      </LiveHost>,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Поток жил дольше порога и не принёс ни одного события — так выглядит
    // рабочий день без обращений. Закрытие по сроку не должно наказываться
    // паузой: полчаса ожидания уже прошли.
    await vi.advanceTimersByTimeAsync(6000);
    отпустить.сейчас?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
