package ru.vedal.portal.gateway;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Проверка {@link ServiceLeadNamesTheDevice}: у сервисной заявки должны быть
 * и изделие, и серийный номер.
 */
public class ServiceLeadNamesTheDeviceValidator
        implements ConstraintValidator<ServiceLeadNamesTheDevice, LeadSubmission> {

    /** Форма, для которой изделие и номер обязательны. Остальные четыре — нет. */
    private static final String SERVICE = "service";

    // Тексты согласованы с формой на сайте и повторяются в ней слово в слово:
    // одна и та же ошибка не должна звучать по-разному до отправки и после.
    // Где искать номер на аппарате, не сказано намеренно: в согласованных
    // материалах этого нет, а придуманная подсказка отправит человека не туда.
    static final String SERIAL_REQUIRED =
            "Укажите серийный номер — по нему инженер определит изделие";
    static final String PRODUCT_REQUIRED = "Выберите изделие из списка";

    @Override
    public boolean isValid(LeadSubmission lead, ConstraintValidatorContext context) {
        // Пустое тело и незнакомый тип формы — не наша забота: о них скажут
        // @NotBlank и @Pattern на самом поле form, и говорить о том же вторым
        // сообщением значит показать человеку две ошибки на одну причину.
        if (lead == null || !SERVICE.equals(lead.form())) {
            return true;
        }

        var named = true;
        // Нарушение по умолчанию отключается: оно приехало бы без имени поля,
        // то есть общей строкой над формой — ровно тем, чего мы избегаем.
        context.disableDefaultConstraintViolation();

        if (blank(lead.serialNumber())) {
            violation(context, "serialNumber", SERIAL_REQUIRED);
            named = false;
        }
        if (blank(lead.productSlug())) {
            violation(context, "productSlug", PRODUCT_REQUIRED);
            named = false;
        }

        return named;
    }

    // Незаполненное поле формы приезжает то отсутствующим, то пустой строкой,
    // то пробелами — для человека это одно и то же «не указал».
    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static void violation(ConstraintValidatorContext context, String field, String message) {
        context.buildConstraintViolationWithTemplate(message)
                .addPropertyNode(field)
                .addConstraintViolation();
    }
}
