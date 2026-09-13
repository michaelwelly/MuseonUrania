import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ push: vi.fn(), confirm: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/submit", () => ({ apiUrl: "http://portal", confirmChatNavigation: mocks.confirm }));
import ChatNavigation, { safeChatDestination } from "./ChatNavigation";
const page = { type: "navigate" as const, title: "Изделие", url: "/products/vedal-a-2000/", confirmationRequired: true };
beforeEach(() => { mocks.push.mockReset(); mocks.confirm.mockReset().mockResolvedValue(true); });
it("requires confirmation and permits cancelling without navigation or request", () => {
  render(<ChatNavigation actions={[page]} visitor="visitor" messageId="message" />);
  fireEvent.click(screen.getByRole("button", { name: "Открыть: Изделие" }));
  expect(mocks.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(mocks.confirm).not.toHaveBeenCalled();
  expect(screen.queryByRole("group")).toBeNull();
});
it("confirms the offered source before navigating while retaining the layout", async () => {
  render(<ChatNavigation actions={[page]} visitor="visitor" messageId="message" />);
  fireEvent.click(screen.getByRole("button", { name: "Открыть: Изделие" }));
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить переход" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(page.url));
  expect(mocks.confirm).toHaveBeenCalledWith("visitor", "message", page);
});
it("keeps the conversation in place when confirmation fails", async () => {
  mocks.confirm.mockResolvedValue(false);
  render(<ChatNavigation actions={[page]} visitor="visitor" messageId="message" />);
  fireEvent.click(screen.getByRole("button", { name: "Открыть: Изделие" }));
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить переход" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Переход не подтверждён");
  expect(mocks.push).not.toHaveBeenCalled();
});
it("opens a confirmed document separately from the conversation", async () => {
  const tab = { opener: {}, location: { href: "about:blank" }, close: vi.fn() };
  const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  const doc = { ...page, type: "document" as const, url: "/api/public/v1/documents/sheet/file" };
  render(<ChatNavigation actions={[doc]} visitor="visitor" messageId="message" />);
  fireEvent.click(screen.getByRole("button", { name: "Открыть: Изделие" }));
  fireEvent.click(screen.getByRole("button", { name: "Подтвердить переход" }));
  await waitFor(() => expect(tab.location.href).toBe("http://portal" + doc.url));
  expect(tab.opener).toBeNull();
  expect(mocks.push).not.toHaveBeenCalled();
  open.mockRestore();
});
it("rejects external, administrative, encoded and protocol-relative destinations", () => {
  for (const url of ["//evil.example", "javascript:alert(1)", "/admin/", "/products/%2fadmin", "/products/../admin/", "https://evil.example"]) {
    expect(safeChatDestination({ ...page, url })).toBe(false);
  }
});
