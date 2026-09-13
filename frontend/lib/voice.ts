import { apiUrl } from "./submit";

/** Mono PCM16 little-endian at 16 kHz, capped at SpeechKit's 30-second limit. */
export function pcm16(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const length = Math.min(480000, Math.floor(channels[0].length * 16000 / sampleRate));
  const buffer = new ArrayBuffer(length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * sampleRate / 16000);
    const end = Math.max(start + 1, Math.floor((i + 1) * sampleRate / 16000));
    let sum = 0;
    for (const channel of channels) {
      for (let j = start; j < end; j++) sum += channel[Math.min(j, channel.length - 1)];
    }
    const value = Math.max(-1, Math.min(1, sum / ((end - start) * channels.length)));
    view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}

export async function voiceRequest(path: string, body: BodyInit, type: string, signal: AbortSignal) {
  const response = await fetch(`${apiUrl}/api/assistant/v1/voice/${path}`, {
    method: "POST", body, signal, cache: "no-store",
    headers: { "Content-Type": type, "X-Voice-Consent": "true" },
  });
  if (!response.ok) throw new Error("Голос временно недоступен. Можно написать сообщение.");
  return response;
}
