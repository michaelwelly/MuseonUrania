import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useLoad, when, waited } from "./ui";

// Хук загрузки страницы. Три свойства, которые ломаются молча и дорого:
// ответ на отменённый запрос не должен побеждать свежий, данные не должны
// мигать пустотой при обновлении, а ошибка действия не должна стираться
// перезагрузкой списка.

function Probe({ load, keyValue }: { load: () => Promise<string>; keyValue?: string }) {
  const { data, error, loading, reload, setError } = useLoad<string>(load, keyValue);
  return (
    <div>
      <span data-testid="data">{data ?? "—"}</span>
      <span data-testid="error">{error ?? "—"}</span>
      <span data-testid="loading">{loading ? "да" : "нет"}</span>
      <button onClick={reload}>Обновить</button>
      <button onClick={() => setError("не сохранилось")}>Сломать</button>
    </div>
  );
}

describe("useLoad", () => {
  it("показывает загруженное и снимает признак загрузки", async () => {
    render(<Probe load={async () => "готово"} />);

    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("готово"));
    expect(screen.getByTestId("loading")).toHaveTextContent("нет");
  });

  it("доносит отказ загрузки словами", async () => {
    render(<Probe load={async () => { throw new Error("портал не отвечает"); }} />);

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("портал не отвечает"),
    );
  });

  // Список не должен мигать пустотой на каждом обновлении после действия:
  // это дёргает страницу и сбивает прицел мыши.
  it("держит прошлые данные на экране, пока едут новые", async () => {
    const user = userEvent.setup();
    // Второй запрос держим открытым, пока не разрешим его вручную:
    // именно в этот промежуток и проверяется, что на экране осталось.
    let releaseSecond: (value: string) => void = () => {};
    const second = new Promise<string>((resolve) => {
      releaseSecond = resolve;
    });

    let call = 0;
    render(<Probe load={() => (call++ === 0 ? Promise.resolve("первое") : second)} />);

    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("первое"));

    await user.click(screen.getByRole("button", { name: "Обновить" }));

    // Новое ещё не приехало: старое на месте, признак загрузки поднят.
    expect(screen.getByTestId("data")).toHaveTextContent("первое");
    expect(screen.getByTestId("loading")).toHaveTextContent("да");

    releaseSecond("второе");
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("второе"));
    expect(screen.getByTestId("loading")).toHaveTextContent("нет");
  });

  // Ответ на запрос, который уже никому не нужен, не должен перетирать свежий.
  it("не пускает на экран ответ отменённого запроса", async () => {
    const user = userEvent.setup();
    const answers = ["медленный первый", "быстрый второй"];
    let call = 0;

    render(
      <Probe
        load={async () => {
          const mine = call++;
          // Первый ответ приходит позже второго.
          await new Promise((r) => setTimeout(r, mine === 0 ? 60 : 0));
          return answers[mine];
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Обновить" }));

    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("быстрый второй"));
    // Даём первому ответу время приехать и не победить.
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.getByTestId("data")).toHaveTextContent("быстрый второй");
  });

  it("перезагружает при смене ключа", async () => {
    const load = vi.fn().mockResolvedValue("значение");
    const { rerender } = render(<Probe load={load} keyValue="a" />);

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender(<Probe load={load} keyValue="b" />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    // Тот же ключ — повторного запроса нет.
    rerender(<Probe load={load} keyValue="b" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(load).toHaveBeenCalledTimes(2);
  });

  // Сообщение «не сохранилось» не должно исчезать оттого, что список
  // обновился: иначе редактор видит успех там, где его не было.
  it("ошибка действия переживает перезагрузку данных", async () => {
    const user = userEvent.setup();
    render(<Probe load={async () => "готово"} />);
    await waitFor(() => expect(screen.getByTestId("data")).toHaveTextContent("готово"));

    await user.click(screen.getByRole("button", { name: "Сломать" }));
    expect(screen.getByTestId("error")).toHaveTextContent("не сохранилось");

    await user.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("нет"));
    expect(screen.getByTestId("error")).toHaveTextContent("не сохранилось");
  });
});

describe("формат даты", () => {
  it("пустое значение показывает прочерком, а не Invalid Date", () => {
    expect(when(null)).toBe("—");
  });

  it("неразбираемую строку отдаёт как есть, а не как Invalid Date", () => {
    expect(when("не дата")).toBe("не дата");
  });
});

// Сколько ждёт разговор.
//
// Портал считает ожидание в минутах, и для разговора, которому семь минут,
// это правильная единица. Для разговора, который ждёт четвёртые сутки, —
// уже нет: замер на стенде показал в очереди «5796 мин». Число верное
// и совершенно нечитаемое; сравнить «5796» и «1481» с одного взгляда
// нельзя, а очередь ровно для этого и нужна.
describe("сколько ждёт", () => {
  it("до часа считает минутами — в разговоре они и есть единица", () => {
    expect(waited(0)).toBe("только что");
    expect(waited(7)).toBe("7 мин");
    expect(waited(59)).toBe("59 мин");
  });

  it("дальше переходит на часы и сутки", () => {
    expect(waited(60)).toBe("1 час");
    expect(waited(125)).toBe("2 часа");
    expect(waited(1481)).toBe("1 день");
    expect(waited(5796)).toBe("4 дня");
  });

  it("согласует слово с числом", () => {
    expect(waited(5 * 60)).toBe("5 часов");
    expect(waited(11 * 60)).toBe("11 часов");
    expect(waited(21 * 60)).toBe("21 час");
    expect(waited(11 * 24 * 60)).toBe("11 дней");
  });
});
