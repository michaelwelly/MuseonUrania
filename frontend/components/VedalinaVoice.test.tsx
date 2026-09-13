import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VoiceInput, VoiceReply } from "./VedalinaVoice";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("voice consent and failure isolation", () => {
  it("requests consent before accessing a microphone", () => {
    const requestConsent = vi.fn(); const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    render(<VoiceInput consent={false} requestConsent={requestConsent} onTranscript={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Записать голосовое сообщение" }));
    expect(requestConsent).toHaveBeenCalledOnce(); expect(getUserMedia).not.toHaveBeenCalled();
  });
  it("explains denied permission and restores the microphone button", async () => {
    vi.stubGlobal("MediaRecorder", class {});
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")) } });
    render(<VoiceInput consent requestConsent={vi.fn()} onTranscript={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Записать голосовое сообщение" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Доступ к микрофону не разрешён");
    expect(screen.getByRole("button", { name: "Записать голосовое сообщение" })).toBeEnabled();
  });
  it("does not transmit text for synthesis before consent", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const requestConsent = vi.fn();
    render(<VoiceReply text="Ответ" consent={false} requestConsent={requestConsent} />);
    fireEvent.click(screen.getByRole("button", { name: "Прослушать ответ" }));
    expect(fetch).not.toHaveBeenCalled(); expect(requestConsent).toHaveBeenCalledOnce();
  });
  it("keeps failed synthesis retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<VoiceReply text="Ответ" consent requestConsent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Прослушать ответ" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ответ можно прочитать"));
    expect(screen.getByRole("button", { name: "Прослушать ответ" })).toBeEnabled();
  });
});
