package ru.vedal.portal.documents;

import ru.vedal.portal.common.PayloadTooLargeException;

// Общее для обеих реализаций порта: предел размера и определение типа
// содержимого по расширению.
final class StorageLimits {

    private StorageLimits() {}

    // Настоящая защита от большого файла стоит выше — в разборе multipart,
    // который обрывает чтение, не доведя тело до кучи. Здесь вторая линия:
    // она закрывает вызывающих, пришедших не через форму (разбор почты,
    // импорт), и делает предел свойством хранилища, а не одной двери.
    static void check(long size, long limit) {
        if (size > limit) {
            throw new PayloadTooLargeException(
                    "Файл больше разрешённых " + megabytes(limit) + " МБ (в файле "
                            + megabytes(size) + " МБ)");
        }
    }

    // Округление вверх: 20.4 МБ при пределе 20 не должно печататься как
    // «20 МБ при пределе 20 МБ».
    private static long megabytes(long bytes) {
        return Math.ceilDiv(bytes, 1024L * 1024L);
    }

    // Тип по расширению ключа. Ключ формирует портал, а не загружающий,
    // поэтому расширению здесь можно верить.
    static String contentType(String key) {
        var lower = key.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }
}
