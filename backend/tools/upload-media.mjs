// Заливка статических фотографий в локальное объектное хранилище.
//
// Запуск из корня репозитория:
//   node backend/tools/upload-media.mjs
//
// Источник — frontend/public/photos, приёмник — бакет vedal-media в MinIO,
// который поднимается из backend/compose.yaml. Ключи повторяют пути внутри
// каталога, поэтому /photos/products/vedal-r1-r2.jpg на сайте и
// photos/products/vedal-r1-r2.jpg в бакете — одно и то же.
//
// Почему через контейнер mc, а не клиентом на node: у tools нет package.json
// и заводить его ради разовой заливки незачем, а Docker здесь всё равно нужен —
// без него нет и самого хранилища. В облаке файлы поедут своим путём, этот
// скрипт про машину разработчика.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = resolve("frontend/public/photos");
const BUCKET = "vedal-media";
const NETWORK = "backend_default";
const MC = "minio/mc:RELEASE.2025-04-16T18-13-26Z";

if (!existsSync(SOURCE)) {
  console.error(`Не нашёл ${SOURCE}. Скрипт запускается из корня репозитория.`);
  process.exit(1);
}

// На Windows Git Bash переписывает пути внутри аргументов Docker: /photos
// превращается в C:/Program Files/Git/photos. Переменная это отключает.
const env = { ...process.env, MSYS_NO_PATHCONV: "1" };

const script = [
  "mc alias set l http://minio:9000 vedal vedal-local-secret >/dev/null",
  `mc cp --recursive /source/ l/${BUCKET}/photos/ >/dev/null`,
  `mc ls --recursive l/${BUCKET}`,
].join(" && ");

try {
  const out = execFileSync(
    "docker",
    [
      "run", "--rm",
      "--network", NETWORK,
      "-v", `${SOURCE}:/source:ro`,
      "--entrypoint", "/bin/sh",
      MC,
      "-c", script,
    ],
    { env, encoding: "utf8" },
  );

  const files = out.trimEnd().split("\n").filter(Boolean);
  console.log(out.trimEnd());
  console.log(`\nв бакете ${BUCKET}: ${files.length} файл(ов)`);
} catch (error) {
  console.error("Заливка не прошла. Хранилище поднято?");
  console.error("  docker compose -f backend/compose.yaml up -d minio minio-init\n");
  console.error(error.stderr?.toString() ?? error.message);
  process.exit(1);
}
