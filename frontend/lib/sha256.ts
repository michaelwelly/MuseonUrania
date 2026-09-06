// SHA-256 своими руками — для PKCE там, где браузер не даёт встроенный.
//
// Считать хеш вручную в 2026 году выглядит дикостью: он есть в каждом
// браузере, в `crypto.subtle`. Беда в том, что `crypto.subtle` существует
// только в защищённом контексте — https либо `localhost`. Стенд работает
// по http на адресе-числе, и там объекта нет вовсе: обращение к нему падает
// не отказом, а `Cannot read properties of undefined (reading 'digest')`,
// и вход умирает раньше первого запроса к Keycloak. Тот же случай, что
// с `crypto.randomUUID` в `submit.ts`.
//
// Альтернативы были хуже. Отправлять `code_challenge_method: plain` значит
// класть verifier в адресную строку — ровно то, от чего PKCE защищает.
// Отказаться от PKCE — то же самое, только честнее. Тянуть библиотеку ради
// сорока строк арифметики — лишняя зависимость в том самом коде, который
// решает, пускать человека или нет.
//
// Это запасной путь, а не замена: где встроенный хеш есть, зовётся он —
// он быстрее и его не нужно проверять. См. `challenge()` в `auth.ts`.
//
// Реализация прямая по FIPS 180-4, без потоковой подачи: PKCE-verifier —
// это 43 символа, весь ввод помещается в один-два блока.

/** Первые 32 бита дробных частей кубических корней первых 64 простых. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => ((x >>> n) | (x << (32 - n))) >>> 0;

/** Хеш SHA-256 от произвольных байт. Возвращает 32 байта. */
export function sha256(message: Uint8Array): Uint8Array {
  // Первые 32 бита дробных частей квадратных корней первых восьми простых.
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);

  // Дополнение: единичный бит, нули и длина в битах восемью байтами —
  // ровно до целого числа блоков по 64 байта.
  const padded = new Uint8Array(((((message.length + 8) >> 6) + 1) << 6));
  padded.set(message);
  padded[message.length] = 0x80;

  const view = new DataView(padded.buffer);
  const bits = message.length * 8;
  view.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32), false);
  view.setUint32(padded.length - 4, bits >>> 0, false);

  const w = new Uint32Array(64);

  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;

    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + choice + K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    const round = [a, b, c, d, e, f, g, hh];
    for (let i = 0; i < 8; i++) h[i] = (h[i] + round[i]) >>> 0;
  }

  const digest = new Uint8Array(32);
  const out = new DataView(digest.buffer);
  for (let i = 0; i < 8; i++) out.setUint32(i * 4, h[i], false);
  return digest;
}
