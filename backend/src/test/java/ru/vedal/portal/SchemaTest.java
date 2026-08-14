package ru.vedal.portal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SchemaTest extends PostgresTestBase {

    @Autowired
    JdbcClient jdbc;

    @Test
    void migrationCreatesCatalogTables() {
        var tables = jdbc.sql("""
                        select table_name from information_schema.tables
                        where table_schema = 'public'
                        """)
                .query(String.class)
                .list();

        assertThat(tables).contains("category", "product", "product_category", "product_spec");
    }

    @Test
    void migrationCreatesCrmTables() {
        var tables = jdbc.sql("""
                        select table_name from information_schema.tables
                        where table_schema = 'public'
                        """)
                .query(String.class)
                .list();

        assertThat(tables).contains("lead", "client", "deal", "quote", "quote_item",
                "interaction", "deal_document");
    }

    // Стадия из чужой воронки не должна сохраняться, даже если её пронесли
    // мимо домена — прямым запросом, импортом или правкой в консоли.
    @Test
    void stageFromAnotherPipelineIsRefusedByTheDatabase() {
        var client = UUID.randomUUID();
        jdbc.sql("insert into client (id, name, kind) values (?, ?, 'company')")
                .params(client, "Проба схемы").update();

        assertThatThrownBy(() -> jdbc.sql("""
                        insert into deal (id, client_id, pipeline, title, stage)
                        values (?, ?, 'sales', 'Проба', 'repair')
                        """)
                .params(UUID.randomUUID(), client)
                .update())
                .hasMessageContaining("deal_stage_check");
    }

    // Заявка разбирается один раз: двойное нажатие «завести сделку» не должно
    // порождать две сделки по одному обращению.
    @Test
    void oneLeadCannotBecomeTwoDeals() {
        var client = UUID.randomUUID();
        jdbc.sql("insert into client (id, name, kind) values (?, ?, 'company')")
                .params(client, "Проба схемы").update();

        var lead = UUID.randomUUID();
        jdbc.sql("""
                        insert into lead (id, form, name, phone, email, message,
                                          consent_version, consent_at, source, status)
                        values (?, 'quote', 'Проба', '+70000000000', 'p@example.ru', 'текст',
                                'v1', now(), 'site', 'new')
                        """)
                .param(lead).update();

        jdbc.sql("""
                        insert into deal (id, client_id, lead_id, pipeline, title, stage)
                        values (?, ?, ?, 'sales', 'Первая', 'new')
                        """)
                .params(UUID.randomUUID(), client, lead).update();

        assertThatThrownBy(() -> jdbc.sql("""
                        insert into deal (id, client_id, lead_id, pipeline, title, stage)
                        values (?, ?, ?, 'sales', 'Вторая', 'new')
                        """)
                .params(UUID.randomUUID(), client, lead)
                .update())
                .hasMessageContaining("deal_lead_idx");
    }

    // Запись истории обязана быть привязана хоть к чему-то: висящая в воздухе
    // переписка не находится ни из одной карточки.
    @Test
    void interactionWithoutSubjectIsRefused() {
        assertThatThrownBy(() -> jdbc.sql("""
                        insert into interaction (id, kind, body, actor)
                        values (?, 'call', 'Позвонили', 'tester')
                        """)
                .param(UUID.randomUUID())
                .update())
                .hasMessageContaining("interaction_has_subject");
    }
}
