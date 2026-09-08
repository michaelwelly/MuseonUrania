package ru.vedal.portal.common;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.type.AnnotatedTypeMetadata;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

// Автоочистка существует только тогда, когда срок хранения НАЗВАН.
//
// ————— зачем своя аннотация вместо @ConditionalOnProperty —————
//
// @ConditionalOnProperty считает свойство заданным по факту его наличия:
// пустая строка для него — такое же значение, как «P3Y». Для срока хранения
// это неверно. Пустая переменная не означает «удаляй»; она означает, что
// строку в окружении завели, а число не назвали, — ровно то состояние,
// в котором мы и находимся с открытого вопроса 12.2.
//
// Разница не теоретическая. Переменные VEDAL_PRIVACY_RETENTION* доезжают
// до портала через compose, и в backend/.env.example они перечислены пустыми:
// оператору надо видеть, что рычаг есть. С @ConditionalOnProperty пустое
// значение создало бы бин, Period.parse("") бросил бы исключение — и портал
// не поднялся бы вовсе из-за настройки, которую никто не включал.
//
// Здесь пустое и состоящее из пробелов значение равно отсутствующему:
// бин не создаётся, в логе о нём ни слова, данные не трогаются. Опечатка
// в непустом значении по-прежнему роняет старт — это правильно: «P3Х»
// с русской Х это заявка на удаление, разобрать которую не удалось,
// и молчать о ней нельзя.
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@Conditional(OnRetentionTerm.TermIsNamed.class)
public @interface OnRetentionTerm {

    // Имя свойства со сроком, например vedal.privacy.retention.chat.
    String value();

    class TermIsNamed implements Condition {

        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            var attributes = metadata.getAnnotationAttributes(OnRetentionTerm.class.getName());
            if (attributes == null) return false;

            var property = (String) attributes.get("value");
            var term = context.getEnvironment().getProperty(property);

            return term != null && !term.isBlank();
        }
    }
}
