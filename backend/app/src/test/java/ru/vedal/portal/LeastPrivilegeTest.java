package ru.vedal.portal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Права роли приложения: чего она не должна уметь вовсе.
//
// Проверяются сами права, а не попытка их применить, и это вынужденно.
// В тестовом контейнере роль — суперпользователь (образ `postgres` заводит
// POSTGRES_USER именно так), а суперпользователь проверку прав не проходит,
// он её не проходит вовсе: TRUNCATE у него получится при любом ACL.
// Поэтому здесь сверяется то, что миграция действительно устанавливает —
// выданные права, — а не то, что от них зависит в конкретной среде.
//
// Из этого же следует требование к развёртыванию: роль приложения обязана
// быть обычной. Суперпользователь превращает всё, что ниже, в украшение,
// и держит журнал тогда один триггер.
class LeastPrivilegeTest extends PostgresTestBase {

    @Autowired
    JdbcClient jdbc;

    // Отзыв в V15 покрыл таблицы, которые существовали на тот момент. Таблица,
    // заведённая следующей миграцией, приезжает с полными правами владельца.
    // Без этой проверки разница между «TRUNCATE отозван» и «TRUNCATE отозван,
    // кроме трёх таблиц, добавленных в сентябре» не видна вообще ниоткуда.
    @Test
    void noTableGrantsTruncateToTheApplicationRole() {
        // relacl = null означает «права по умолчанию», то есть у владельца
        // есть всё. Пустой ACL и отсутствующий ACL — разные вещи, и считать
        // отсутствующий безопасным значит проглядеть каждую новую таблицу.
        var truncatable = jdbc.sql("""
                        select c.relname from pg_class c
                        join pg_namespace n on n.oid = c.relnamespace
                        where n.nspname = 'public'
                          and c.relkind = 'r'
                          and (c.relacl is null
                               or exists (select 1 from aclexplode(c.relacl) a
                                          where a.privilege_type = 'TRUNCATE'))
                        order by c.relname
                        """)
                .query(String.class)
                .list();

        assertThat(truncatable)
                .as("""
                        На этих таблицах TRUNCATE не отозван. Допишите в миграцию, \
                        которая их завела: \
                        revoke truncate on <таблица> from public, current_user;""")
                .isEmpty();
    }

    @Test
    void journalGrantsOnlyAppendAndRead() {
        var granted = jdbc.sql("""
                        select distinct a.privilege_type
                        from pg_class c, aclexplode(c.relacl) a
                        where c.relname = 'audit_entry'
                        """)
                .query(String.class)
                .list();

        assertThat(granted).contains("INSERT", "SELECT");
        assertThat(granted).doesNotContain("UPDATE", "DELETE", "TRUNCATE");
    }

    // Права владелец схемы может вернуть себе обратно одной строкой — в этом
    // слабость отзыва как единственной меры, и ровно поэтому мер две. Триггер
    // так не обойти: его надо явно отключить, а это уже не опечатка в консоли.
    //
    // Отказ идёт последним: он рвёт транзакцию, и любой запрос после него
    // упал бы «текущая транзакция прервана» вместо своей настоящей причины.
    @Test
    void journalRefusesTruncateEvenWithThePrivilegeBack() {
        jdbc.sql("grant truncate on audit_entry to current_user").update();

        assertThatThrownBy(() -> jdbc.sql("truncate audit_entry").update())
                .hasMessageContaining("append-only");
    }
}
