import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { sha256 } from "./sha256";

const hex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

const bytes = (text: string) => new TextEncoder().encode(text);

describe("SHA-256 без crypto.subtle", () => {
  // Опубликованные значения из FIPS 180-4: если бы сверка шла только
  // с node:crypto, обе стороны могли бы ошибаться одинаково.
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
  ])("совпадает с образцом на %j", (input, expected) => {
    expect(hex(sha256(bytes(input)))).toBe(expected);
  });

  // Границы блока — единственное место, где дополнение можно посчитать
  // неверно и не заметить: 55 байт ещё влезают в блок вместе с длиной,
  // 56 уже требуют второго, 64 — ровно блок.
  it.each([0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 200])(
    "совпадает со штатным хешем на %i байтах",
    (length) => {
      const input = new Uint8Array(length).map((_, i) => (i * 37) % 256);
      const expected = createHash("sha256").update(input).digest("hex");
      expect(hex(sha256(input))).toBe(expected);
    },
  );

  it("не портит исходные байты", () => {
    const input = bytes("verifier");
    const before = hex(input);
    sha256(input);
    expect(hex(input)).toBe(before);
  });
});
