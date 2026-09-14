import { describe, expect, it } from "vitest";
import { pcm16 } from "./voice";

describe("SpeechKit PCM", () => {
  it("mixes stereo and downsamples to signed little-endian 16kHz", () => {
    const bytes = pcm16(
      [new Float32Array(6).fill(1), new Float32Array(6).fill(0)],
      48000,
    );
    expect(bytes.byteLength).toBe(4);
    expect(new DataView(bytes).getInt16(0, true)).toBe(16384);
  });

  it("clips samples and caps audio at 30 seconds", () => {
    const bytes = pcm16([new Float32Array(16000 * 31).fill(-2)], 16000);
    expect(bytes.byteLength).toBe(960000);
    expect(new DataView(bytes).getInt16(0, true)).toBe(-32768);
  });
});
