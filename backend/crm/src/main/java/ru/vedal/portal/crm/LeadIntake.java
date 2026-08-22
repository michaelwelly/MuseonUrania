package ru.vedal.portal.crm;

import java.util.UUID;

// Единственное, что crm показывает соседям. Заявка приходит только отсюда —
// gateway не знает ни про сущность, ни про репозиторий.
public interface LeadIntake {

    // language и campaign — атрибуция: язык страницы и кампания, с которой
    // пришёл посетитель. Необязательные: заявка, отправленная в обход
    // кампании, остаётся заявкой, а разрез по кампании честно показывает
    // её в «—».
    // serialNumber — серийный номер изделия из сервисного обращения. Стоит
    // рядом с productSlug, потому что это одно и то же: чем именно человек
    // пользуется. Необязателен — номер знают не всегда.
    record Draft(String form, String name, String company, String phone, String email,
                 String productSlug, String serialNumber, String message, String source,
                 String language, String campaign) {}

    record Receipt(UUID id, boolean created) {}

    Receipt accept(Draft draft, String idempotencyKey);
}
