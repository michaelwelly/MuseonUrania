package ru.vedal.portal.crm;

import java.util.UUID;

// Единственное, что crm показывает соседям. Заявка приходит только отсюда —
// gateway не знает ни про сущность, ни про репозиторий.
public interface LeadIntake {

    record Draft(String form, String name, String company, String phone, String email,
                 String productSlug, String message, String source) {}

    record Receipt(UUID id, boolean created) {}

    Receipt accept(Draft draft, String idempotencyKey);
}
