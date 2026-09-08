package ru.vedal.portal.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ResourceLoader;
import org.springframework.core.type.AnnotationMetadata;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

// Само условие, без контекста Spring: какие значения считаются названным
// сроком, а какие — нет.
//
// Контекстный тест (EmptyRetentionTermTest) проверяет одно значение —
// пустое, потому что каждое новое сочетание свойств стоит отдельного
// контекста и отдельного подъёма портала. Разбор остальных случаев дешевле
// здесь: условие — обычный объект.
class OnRetentionTermTest {

    private static final String PROPERTY = "vedal.privacy.retention";

    @OnRetentionTerm(PROPERTY)
    private static class Sample {
    }

    @Test
    void namedTermTurnsTheSweepOn() {
        assertThat(matches("P3Y")).isTrue();
    }

    // Отсутствие свойства — исходное состояние портала: срок не назван,
    // и автоочистки нет.
    @Test
    void missingPropertyLeavesTheSweepOut() {
        assertThat(matches(null)).isFalse();
    }

    // Пустая строка — это `VEDAL_PRIVACY_RETENTION=` в .env. Строку завели,
    // числа не назвали.
    @Test
    void emptyValueIsNotATerm() {
        assertThat(matches("")).isFalse();
    }

    // Пробелы — та же опечатка, тот же ответ. Именно ради этих двух случаев
    // условие своё, а не @ConditionalOnProperty: для того пустая строка —
    // заданное значение, и бин бы создался.
    @Test
    void blankValueIsNotATerm() {
        assertThat(matches("   ")).isFalse();
    }

    private boolean matches(String term) {
        var environment = new MockEnvironment();
        if (term != null) environment.setProperty(PROPERTY, term);

        var metadata = AnnotationMetadata.introspect(Sample.class);
        return new OnRetentionTerm.TermIsNamed().matches(contextOf(environment), metadata);
    }

    // ConditionContext целиком нужен только ради getEnvironment(): условие
    // ничего другого не спрашивает. Заглушка вместо Mockito — меньше кода
    // и видно, что именно используется.
    private ConditionContext contextOf(Environment environment) {
        return new ConditionContext() {
            @Override
            public BeanDefinitionRegistry getRegistry() {
                return null;
            }

            @Override
            public ConfigurableListableBeanFactory getBeanFactory() {
                return null;
            }

            @Override
            public Environment getEnvironment() {
                return environment;
            }

            @Override
            public ResourceLoader getResourceLoader() {
                return null;
            }

            @Override
            public ClassLoader getClassLoader() {
                return getClass().getClassLoader();
            }
        };
    }
}
