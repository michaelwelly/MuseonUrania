package ru.vedal.portal.crm;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LeadRepository extends JpaRepository<Lead, UUID> {

    Optional<Lead> findByIdempotencyKey(String idempotencyKey);

    // Номер выдаёт последовательность базы, а не счётчик в коде: две заявки,
    // отправленные в одну секунду, получили бы у счётчика один номер — и дальше
    // спор о том, какая из них та самая. Тем же способом нумеруются КП.
    @Query(value = "select nextval('lead_number_seq')", nativeQuery = true)
    long nextNumber();

    // Отбор для автоочистки: старше срока и ещё не обезличенные. Под него
    // заведён частичный индекс lead_retention_idx — обезличенные из выборки
    // уходят навсегда, и место под них в индексе держать незачем, а со
    // временем их становится большинство.
    //
    // Пачкой, а не всё сразу: за первый проход после включения под нож пойдёт
    // всё накопленное, и одной транзакцией это блокировка таблицы на минуты.
    List<Lead> findByCreatedAtBeforeAndErasedAtIsNull(Instant cutoff, Pageable page);

    List<Lead> findAllByOrderByCreatedAtDesc();

    // Постранично: заявки копятся без предела, и «показать все» однажды
    // означает выгрузить всю базу в память ради одной страницы списка.
    Page<Lead> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Lead> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    // Отбор списка заявок: статус, ответственный, форма, источник и поиск
    // по контактам — одним запросом, потому что менеджер комбинирует их
    // как хочет. Пять отдельных методов на пять сочетаний означали бы
    // тридцать два метода на пять признаков.
    //
    // Параметр owner со значением «-» означает «без ответственного». Отдельным
    // булевым параметром это выглядело бы честнее, но два параметра на одно
    // понятие умеют противоречить друг другу: owner=ivan вместе с
    // unassigned=true — состояние, которого не бывает, а обработать его
    // всё равно придётся.
    //
    // Поиск по телефону — тем же like, без нормализации: в базе номер лежит
    // так, как его прислала форма, и менеджер ищет по тому, что видит
    // в списке. Номер, записанный с пробелами, по цифрам подряд не найдётся;
    // это станет важно, когда в форме появится маска ввода.
    //
    // Серийный номер ищется наравне с контактами, и это главное, ради чего
    // он вообще стал колонкой: заказчик звонит и называет номер аппарата,
    // а не своё имя. Заявки без номера в поиск не попадают сами собой —
    // lower(null) даёт null, а null не равен «истине».
    //
    // `:query` приходит пустой строкой, а не null, и это не небрежность.
    // Внутри lower(concat(...)) нетипизированный null уезжает в PostgreSQL
    // как bytea, и запрос падает на «function lower(bytea) does not exist» —
    // причём только тогда, когда поиск НЕ задан, то есть при обычном
    // открытии списка. Пустая строка типизирована, и вопрос снимается
    // целиком, а не подпирается приведением у каждого из четырёх полей.
    @Query("""
            select l from Lead l
            where (:status is null or l.status = :status)
              and (:form is null or l.form = :form)
              and (:source is null or l.source = :source)
              and (:owner is null
                   or (:owner = '-' and l.owner is null)
                   or l.owner = :owner)
              and (:query = ''
                   or lower(l.name) like lower(concat('%', :query, '%'))
                   or lower(l.company) like lower(concat('%', :query, '%'))
                   or l.phone like concat('%', :query, '%')
                   or lower(l.email) like lower(concat('%', :query, '%'))
                   or lower(l.serialNumber) like lower(concat('%', :query, '%')))
            order by l.createdAt desc
            """)
    Page<Lead> filter(@Param("status") String status,
                      /** Пустая строка — «поиска нет». Не null: см. выше. */
                      @Param("query") String query,
                      @Param("owner") String owner,
                      @Param("form") String form,
                      @Param("source") String source,
                      Pageable pageable);
}
