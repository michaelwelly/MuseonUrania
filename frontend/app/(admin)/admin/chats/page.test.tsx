import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Раздел «Разговоры».
//
// Два дефекта, найденные владельцем на живом стенде, и оба ловятся числом,
// а не глазом:
//
// 1. Первые строки обращений читались один раз по двенадцать штук. Список
//    отдаёт двадцать одну карточку, и с тринадцатой по двадцать первую
//    навсегда оставалась надпись «обращение читается…». Не замечал этого
//    никто ровно потому, что очередь жила в своей полосе прокрутки высотой
//    в четыре карточки — до тринадцатой не долистывал никто.
//
// 2. Без выбранного разговора две трети экрана занимала надпись «Выберите
//    разговор слева». Дежурный заходит сюда ответить тому, кто ждёт дольше
//    всех; ровно этот разговор и должен открываться.

const mocks = vi.hoisted(() => ({
  chatsAll: vi.fn(),
  chatQueue: vi.fn(),
  chatThread: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  chatsAll: mocks.chatsAll,
  chatQueue: mocks.chatQueue,
  chatThread: mocks.chatThread,
  eraseChatData: vi.fn(),
  closeChat: vi.fn(),
  replyInChat: vi.fn(),
  pingTypingInChat: vi.fn(),
  // Плашка дежурства живёт в шапке раздела и к списку отношения не имеет:
  // её двери отвечают пустотой, лишь бы не ходили в сеть.
  dutyToday: () => Promise.resolve(null),
  staff: () => Promise.resolve([]),
  handOffDuty: vi.fn(),
}));

vi.mock("../live", () => ({ useLive: () => {} }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

import ChatsPage from "./page";

const СКОЛЬКО = 21;

/** Двадцать одна карточка: столько разговоров лежит в базе стенда. */
function карточки() {
  return Array.from({ length: СКОЛЬКО }, (_, i) => ({
    id: `c${i}`,
    // Первые три ждут ответа, остальные уже в работе: самооткрытие обязано
    // выбрать ждущего, а не первого попавшегося.
    status: i < 3 ? "waiting" : "attended",
    owner: i < 3 ? null : "editor",
    language: "ru",
    campaign: null,
    page: "/products/vedal-r1/",
    startedAt: "2026-09-08T10:00:00Z",
    lastAt: "2026-09-08T10:20:00Z",
  }));
}

beforeEach(() => {
  const items = карточки();
  mocks.chatsAll.mockReset().mockResolvedValue({
    items,
    page: 0,
    size: 50,
    total: СКОЛЬКО,
  });
  mocks.chatQueue
    .mockReset()
    .mockResolvedValue({ items: items.slice(0, 3), page: 0, size: 50, total: 3 });
  mocks.chatThread.mockReset().mockImplementation((id: string) =>
    Promise.resolve({
      id,
      status: "waiting",
      messages: [
        {
          id: `${id}-1`,
          author: "visitor",
          actor: null,
          body: `вопрос ${id}`,
          sources: [],
          readAt: null,
          at: "2026-09-08T10:00:00Z",
          helpful: null,
        },
      ],
    }),
  );
});

describe("очередь разговоров", () => {
  it("дочитывает первые строки всех разговоров, а не первых двенадцати", async () => {
    render(<ChatsPage />);

    // Двенадцатая — граница одного захода, двадцать первая — конец списка.
    await waitFor(
      () => {
        expect(screen.getByText("вопрос c11")).toBeInTheDocument();
        expect(screen.getByText("вопрос c20")).toBeInTheDocument();
      },
      { timeout: 4000 },
    );

    expect(screen.queryByText("обращение читается…")).not.toBeInTheDocument();
  });

  it("сам открывает того, кто ждёт дольше всех", async () => {
    render(<ChatsPage />);

    // Портал отдаёт ждущих дольше всех первыми, поэтому «первый ждущий»
    // в списке — он и есть.
    await waitFor(() => {
      expect(screen.getByRole("button", { current: true })).toHaveTextContent("вопрос c0");
    });

    expect(screen.queryByText(/Выберите разговор/)).not.toBeInTheDocument();
    // Поле ответа на месте: экран открыт готовым к работе, а не к выбору.
    expect(screen.getByLabelText("Ответ посетителю")).toBeInTheDocument();
  });

  it("щелчок по карточке открывает её разговор", async () => {
    render(<ChatsPage />);
    await waitFor(() => expect(screen.getByText("вопрос c7")).toBeInTheDocument());

    await userEvent.click(screen.getByText("вопрос c7"));

    await waitFor(() =>
      expect(screen.getByRole("button", { current: true })).toHaveTextContent("вопрос c7"),
    );
  });
});
