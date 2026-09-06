package ru.vedal.portal.notifications;

import java.util.UUID;

// Наружу уходит только шаблонное письмо. Тело собирается здесь, снаружи
// передать произвольный текст нельзя — ограничение из брифа собственника,
// шаг «Ответ клиенту»: свободный текст с коммерческими условиями через
// этот модуль не отправляется.
public enum MailTemplate {

    /** Подтверждение клиенту. Текст согласован в content_model.md. */
    LEAD_CONFIRMATION {
        @Override
        String subject() {
            return "VEDAL: заявка принята";
        }

        @Override
        String body(Context context) {
            return """
                    Здравствуйте.

                    Спасибо. Специалист VEDAL свяжется с вами.

                    Номер обращения: %s

                    Письмо отправлено автоматически, отвечать на него не нужно.
                    """.formatted(context.number());
        }
    },

    /** Уведомление ответственному менеджеру. */
    LEAD_MANAGER_NOTICE {
        @Override
        String subject() {
            return "Новая заявка с сайта";
        }

        // Без имени, телефона и почты клиента. Из брифа: «клиентская база не
        // живёт в почте» — в открытый контур уходит только указатель на запись
        // в портале, а сами данные остаются внутри.
        @Override
        String body(Context context) {
            return """
                    Поступила заявка с сайта.

                    Форма: %s
                    Изделие: %s
                    Номер обращения: %s

                    Контакты клиента — в портале: %s/admin/leads/
                    """.formatted(context.form(),
                    context.productSlug() == null ? "не указано" : context.productSlug(),
                    context.number(), context.portalUrl());
        }
    };

    /**
     * Чем письмо называет заявку.
     *
     * <p>Номер, а не идентификатор, и это была настоящая ошибка: в письме
     * стояло «Номер обращения: 550e8400-e29b-41d4-a716-446655440000». Человек,
     * позвонивший с этим письмом в руках, не мог прочесть номер вслух,
     * а менеджер — найти по услышанному заявку.
     *
     * <p>Идентификатор здесь остаётся: по нему письмо связывается с заявкой
     * внутри портала, и в журнале это он.
     */
    record Context(UUID leadId, String number, String form, String productSlug, String portalUrl) {}

    abstract String subject();

    abstract String body(Context context);
}
