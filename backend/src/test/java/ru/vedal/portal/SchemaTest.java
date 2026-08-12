package ru.vedal.portal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

import static org.assertj.core.api.Assertions.assertThat;

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
}
