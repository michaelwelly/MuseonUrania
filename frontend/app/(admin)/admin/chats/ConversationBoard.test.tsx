import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), edit: vi.fn(), digest: vi.fn() }));
vi.mock("@/lib/admin", () => ({
  AdminError: class AdminError extends Error {},
  conversationBoard: mocks.list, editConversationBoard: mocks.edit,
  sendConversationDigest: mocks.digest,
}));
import ConversationBoard from "./ConversationBoard";
const row = { id: "conversation-1", summary: "Нужен аппарат для клиники", stage: "selection", owner: null,
  importance: "urgent", nextAction: "Уточнить комплектацию", updatedAt: "2026-09-13T06:00:00Z", manual: false, version: 4 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ items: [row], total: 21, page: 0, pages: 3, size: 10 });
  mocks.edit.mockResolvedValue({ ...row, manual: true });
  mocks.digest.mockResolvedValue({ date: "2026-09-13", queued: true });
});
it("queues a test report and shows its durable-queue status", async () => {
  const user = userEvent.setup();
  render(<ConversationBoard beat={0} onOpen={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Отправить отчёт сейчас" }));
  expect(await screen.findByText("Отчёт за 2026-09-13 поставлен в очередь")).toBeVisible();
  expect(mocks.digest).toHaveBeenCalledTimes(1);
});
it("filters on the server, pages, and opens the source conversation", async () => {
  const user = userEvent.setup(); const open = vi.fn();
  render(<ConversationBoard beat={0} onOpen={open} />);
  await screen.findByText(row.summary);
  await user.selectOptions(screen.getByLabelText("Стадия"), "ready_for_quote");
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith("ready_for_quote", "", "", 0));
  await user.click(screen.getByRole("button", { name: "Далее" }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith("ready_for_quote", "", "", 1));
  await user.selectOptions(screen.getByLabelText("Важность"), "urgent");
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith("ready_for_quote", "", "urgent", 0));
  await user.click(screen.getByRole("button", { name: /^Разговор$/ }));
  expect(open).toHaveBeenCalledWith(row.id);
});
it("preserves the version and manual mode when saving corrections", async () => {
  const user = userEvent.setup();
  render(<ConversationBoard beat={0} onOpen={() => {}} />);
  await user.click(await screen.findByRole("button", { name: "Исправить" }));
  const form = within(screen.getByRole("form", { name: "Исправление табло" }));
  await user.clear(form.getByLabelText("Кратко"));
  await user.type(form.getByLabelText("Кратко"), "Комплектация согласована");
  await user.selectOptions(form.getByLabelText("Стадия разговора"), "ready_for_quote");
  await user.click(form.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(mocks.edit).toHaveBeenCalledWith(expect.objectContaining({
    id: row.id, version: 4, manual: true, summary: "Комплектация согласована", stage: "ready_for_quote",
  })));
  await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument());
});
it("keeps the draft and shows a conflict instead of silently overwriting", async () => {
  mocks.edit.mockRejectedValue(new Error("Разговор изменился. Обновите данные."));
  const user = userEvent.setup();
  render(<ConversationBoard beat={0} onOpen={() => {}} />);
  await user.click(await screen.findByRole("button", { name: "Исправить" }));
  await user.click(screen.getByRole("button", { name: "Сохранить" }));
  expect(await screen.findByText("Разговор изменился. Обновите данные.")).toBeVisible();
  expect(screen.getByLabelText("Кратко")).toHaveValue(row.summary);
});
