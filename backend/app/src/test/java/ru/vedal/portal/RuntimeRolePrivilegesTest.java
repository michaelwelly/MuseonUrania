package ru.vedal.portal;

import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Права роли, под которой приложение ходит в базу в развёрнутой среде.
//
// Чем этот тест отличается от LeastPrivilegeTest: тот сверяет выданные права по
// системному каталогу, потому что ходит суперпользователем, для которого ACL
// не значит ничего. Здесь открывается вторая, отдельная связь именно рантайм-ролью
// и проверяется не запись о праве, а отказ. Разница существенная: ACL, который
// никто не применял, — гипотеза ровно того же сорта, что невосстановленный бэкап.
//
// Проверять надо обе стороны. Тест, который убедился только в отказах, пропустит
// роль, у которой отозвано лишнее: приложение упадёт при первой же правке
// каталога, а сборка останется зелёной.
class RuntimeRolePrivilegesTest extends PostgresTestBase {

    private Connection asRuntime() throws SQLException {
        return DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), RUNTIME_ROLE, RUNTIME_PASSWORD);
    }

    private void runAsRuntime(String sql) throws SQLException {
        try (var connection = asRuntime(); var statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    // ————— чего рантайм не может —————

    // Главное свойство журнала. Строку в нём нельзя ни исправить, ни удалить —
    // и здесь это проверяется правами, а не триггером: триггер обходится
    // отключением, право — нет.
    @Test
    void journalCannotBeRewrittenOrErased() {
        assertThatThrownBy(() -> runAsRuntime("delete from audit_entry"))
                .hasMessageContaining("audit_entry");
        assertThatThrownBy(() -> runAsRuntime("update audit_entry set actor = 'подмена'"))
                .hasMessageContaining("audit_entry");
    }

    // Триггер audit_entry_append_only держится на том, что его нельзя отключить.
    // Отключение требует владения таблицей, а рантайм ей не владеет — иначе
    // вся защита журнала сводилась бы к одной строке ALTER TABLE.
    @Test
    void journalTriggerCannotBeDisabled() {
        assertThatThrownBy(() -> runAsRuntime("alter table audit_entry disable trigger all"))
                .hasMessageContaining("audit_entry");
    }

    // Ни одна таблица не опустошается целиком: приложение этого не делает нигде,
    // а TRUNCATE обходит и триггеры строк, и внешние ключи.
    @Test
    void noTableCanBeTruncated() {
        assertThatThrownBy(() -> runAsRuntime("truncate lead"))
                .hasMessageContaining("lead");
        assertThatThrownBy(() -> runAsRuntime("truncate audit_entry"))
                .hasMessageContaining("audit_entry");
    }

    // Схему ведёт только Flyway. Рантайм не владеет таблицами, поэтому DDL для
    // него закрыт целиком — включая тот, которым можно было бы снять ограничение
    // и уже потом записать то, что оно запрещало.
    @Test
    void schemaCannotBeChanged() {
        assertThatThrownBy(() -> runAsRuntime("drop table lead"))
                .hasMessageContaining("lead");
        assertThatThrownBy(() -> runAsRuntime("alter table lead drop constraint lead_pkey"))
                .hasMessageContaining("lead");
        assertThatThrownBy(() -> runAsRuntime("create table proba (id int)"))
                .hasMessageContaining("permission denied");
    }

    // Роль не может выдать себе обратно отозванное. Это и отделяет её от владельца
    // схемы: у того отзыв прав — напоминание, а не граница.
    //
    // Проверяется результат, а не отказ команды, и разница здесь неочевидная:
    // PostgreSQL на GRANT, который выдать нечего, отвечает предупреждением
    // «no privileges were granted», а не ошибкой. Тест, ждавший исключения,
    // объявил бы дыру закрытой ровно в том случае, когда она открыта.
    @Test
    void privilegesCannotBeGrantedBack() throws SQLException {
        runAsRuntime("grant delete on audit_entry to " + RUNTIME_ROLE);

        assertThatThrownBy(() -> runAsRuntime("delete from audit_entry"))
                .hasMessageContaining("audit_entry");
    }

    // ————— что рантайм обязан мочь —————

    // Обратная сторона. Урезанная роль, которой приложение не может работать,
    // ломает прод так же надёжно, как избыточная его открывает, — и заметно это
    // будет только на живом редакторе.
    @Test
    void applicationWorkKeepsWorking() throws SQLException {
        var id = UUID.randomUUID();

        // Заявка: единственная запись снаружи.
        runAsRuntime("""
                insert into lead (id, form, name, phone, email, message,
                                  consent_version, consent_at, source, status, created_at)
                values ('%s', 'quote', 'Проверка прав', '+7 343 000-00-00',
                        'prava@example.ru', 'Проверка прав рантайм-роли.',
                        'v1', now(), 'site', 'new', now())
                """.formatted(id));

        // Журнал: только дописывание, и оно обязано работать.
        runAsRuntime("""
                insert into audit_entry (id, at, actor, action, subject, subject_id)
                values ('%s', now(), 'проверка', 'lead.created', 'lead', '%s')
                """.formatted(UUID.randomUUID(), id));

        // Правка и удаление данных: категории, новости, характеристики изделия
        // и позиции КП заменяются целиком, часть — через orphanRemoval.
        runAsRuntime("update lead set status = 'in_progress' where id = '%s'".formatted(id));
        runAsRuntime("delete from lead where id = '%s'".formatted(id));

        try (var connection = asRuntime();
             var statement = connection.createStatement();
             var rows = statement.executeQuery("select count(*) from product")) {
            assertThat(rows.next()).isTrue();
            assertThat(rows.getInt(1)).isPositive();
        }
    }

    // Перечислять таблицы поимённо здесь нельзя: приложение удаляет строки
    // и оттуда, где это не видно в коде — характеристики изделия и позиции КП
    // заменяются целиком через orphanRemoval, и grep по репозиторию их не
    // находит. Поэтому проверяется правило целиком: право на данные есть везде,
    // кроме журнала. Так же ловится и таблица из следующей миграции, которой
    // забыли выдать права, — иначе это выяснилось бы на редакторе.
    @Test
    void everyTableExceptTheJournalIsWritable() {
        var withoutDelete = jdbcForCatalog("""
                select c.relname from pg_class c
                join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relkind = 'r'
                  and c.relname not in ('audit_entry', 'flyway_schema_history')
                  and not has_table_privilege('vedal_app', c.oid, 'DELETE')
                order by c.relname
                """);

        assertThat(withoutDelete)
                .as("""
                        У роли рантайма нет права менять эти таблицы. Правка \
                        каталога упадёт на проде, а сборка этого не увидит: \
                        тесты ходят суперпользователем.""")
                .isEmpty();
    }

    private java.util.List<String> jdbcForCatalog(String sql) {
        try (var connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement();
             var rows = statement.executeQuery(sql)) {

            var names = new java.util.ArrayList<String>();
            while (rows.next()) names.add(rows.getString(1));
            return names;

        } catch (SQLException e) {
            throw new IllegalStateException("Не удалось прочитать права из каталога", e);
        }
    }
}
