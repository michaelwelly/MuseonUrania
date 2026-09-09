package ru.vedal.portal.gateway;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Сервисное обращение обязано называть изделие: и списком, и серийным номером.
 *
 * <p><b>Почему проверка кросс-полевая, а не {@code @NotBlank} на полях.</b>
 * Обязательность здесь зависит от того, какая форма отправлена. В запросе цены
 * или каталога изделия у человека ещё нет, и требовать серийный номер там —
 * значит не пустить к нам того, кто пришёл покупать. А сервисное обращение без
 * изделия и номера — это «что-то сломалось», по которому инженеру нечего взять
 * в работу: он всё равно перезвонит и спросит то же самое, только сутками позже.
 *
 * <p><b>Почему отдельный тип, а не {@code @AssertTrue} на методе записи.</b>
 * Форма показывает ошибку рядом с полем и находит поле по имени из расширения
 * {@code fields}. {@code @AssertTrue} назвал бы нарушение по геттеру — форма
 * такого поля не знает и промолчала бы, а человек увидел бы отказ без причины.
 * Валидатор строит нарушения под именами {@code serialNumber} и
 * {@code productSlug} — теми, что стоят в разметке формы.
 */
@Documented
@Constraint(validatedBy = ServiceLeadNamesTheDeviceValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ServiceLeadNamesTheDevice {

    // Сообщения строит валидатор — их два, и они разные для двух полей.
    // Это общее остаётся только ради контракта аннотации.
    String message() default "Сервисное обращение не называет изделие";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
