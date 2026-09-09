import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Лента разговора: закрытие.
//
// Дефект с живого стенда. Сотрудник нажимал «Закрыть разговор» и получал
// красную плашку «Unexpected end of JSON input» — текст, которым браузер
// отвечает на JSON.parse(""). Разговор при этом закрывался: дверь делала
// свою работу и отвечала пустотой, а клиент разбирал эту пустоту как ответ.
// Сотрудник видел отказ там, где отказа не было, и — хуже — экран не
// обновлялся, потому что до onDone дело не доходило.
//
// Поэтому клиент админского API здесь настоящий, а подменён только слой
// ниже — сеть. Подменив closeChat, мы бы проверили заглушку: она отвечает
// успехом, каким бы ни был ответ портала, и ровно этот дефект пропустила бы.

const BASE = "https://portal.test";

const ЛЕНТА = {
  id: "c-1",
  status: "waiting",
  messages: [
    {
      id: "c-1-1",
      author: "visitor",
      actor: null,
      body: "Сколько стоит инкубатор?",
      sources: [],
      readAt: null,
      at: "2026-09-08T10:00:00Z",
      helpful: null,
    },
  ],
};

// Заглушка ведёт себя как настоящий Response: на пустом теле `json()`
// бросает ровно то, что видел сотрудник, — «Unexpected end of JSON input».
// Заглушка, у которой такого поведения нет, этот дефект не воспроизводит.
const ответ = (status: number, body: string) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body) as unknown,
  }) as Response;

/**
 * Лента на настоящем клиенте: подменена только сеть и токен.
 *
 * `closing` — то, чем дверь закрытия отвечает на POST.
 */
async function поднять(closing: Response) {
  vi.stubEnv("NEXT_PUBLIC_API_URL", BASE);
  vi.resetModules();
  // Вход подменяется целиком: этот набор про закрытие разговора, а не про PKCE.
  vi.doMock("@/lib/auth", () => ({ accessToken: async () => "token-1" }));

  const fetchMock = vi.fn(async (url: string) =>
    String(url).endsWith("/close") ? closing : ответ(200, JSON.stringify(ЛЕНТА)),
  );
  vi.stubGlobal("fetch", fetchMock);

  const { default: Thread } = await import("./Thread");
  return { Thread, fetchMock };
}

describe("закрытие разговора", () => {
  it("пустой ответ двери не превращается в ошибку на экране", async () => {
    // Дверь отвечает пустым телом — именно так, как отвечала на стенде.
    const { Thread, fetchMock } = await поднять(ответ(200, ""));
    const onDone = vi.fn();

    render(<Thread id="c-1" beat={0} typing={false} onDone={onDone} />);
    await screen.findByText("Сколько стоит инкубатор?");

    await userEvent.click(screen.getByRole("button", { name: "Закрыть разговор" }));

    // Действие дошло до портала…
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/close"))).toBe(true),
    );
    // …и вернулось на экран: без onDone список и лента остаются вчерашними.
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));

    expect(document.querySelector(".note--error")).toBeNull();
    expect(screen.queryByText(/JSON/)).not.toBeInTheDocument();
  });

  it("настоящий отказ двери на экран доходит", async () => {
    // Терпимость к пустому телу не должна становиться терпимостью ко всему:
    // проглоченный 404 показал бы сотруднику закрытие, которого не было.
    const { Thread } = await поднять(
      ответ(404, JSON.stringify({ title: "Разговор не найден", status: 404 })),
    );
    const onDone = vi.fn();

    render(<Thread id="c-1" beat={0} typing={false} onDone={onDone} />);
    await screen.findByText("Сколько стоит инкубатор?");

    await userEvent.click(screen.getByRole("button", { name: "Закрыть разговор" }));

    await screen.findByText("Разговор не найден");
    expect(onDone).not.toHaveBeenCalled();
  });
});
