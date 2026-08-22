package ru.vedal.portal.crm;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DealRepository extends JpaRepository<Deal, UUID> {

    Optional<Deal> findByLeadId(UUID leadId);

    // Отбор списка сделок: воронка, стадия, клиент и ответственный — одним
    // запросом. Раньше здесь было четыре метода и ветвление в DealDesk,
    // и в ветвлении clientId не сужал выборку вместе с воронкой, а отменял её.
    // Админка это обходила: при выбранном клиенте посылала воронку пустой —
    // то есть подпирала дверь снаружи, чтобы получить ожидаемое. Любой другой
    // вызов получал бы не то, о чём просил. Пятый признак превратил бы четыре
    // метода в восемь, а вопрос «почему признаки перекрывают друг друга»
    // так и остался бы.
    //
    // Параметр owner со значением «-» означает «без ответственного» — та же
    // договорённость, что у заявок. Отдельным булевым параметром это выглядело
    // бы честнее, но два параметра на одно понятие умеют противоречить
    // друг другу, и обрабатывать несуществующее состояние всё равно придётся.
    @Query("""
            select d from Deal d
            where (:pipeline is null or d.pipeline = :pipeline)
              and (:stage is null or d.stage = :stage)
              and (:clientId is null or d.clientId = :clientId)
              and (:owner is null
                   or (:owner = '-' and d.owner is null)
                   or d.owner = :owner)
            order by d.createdAt desc
            """)
    Page<Deal> filter(@Param("pipeline") String pipeline,
                      @Param("stage") String stage,
                      @Param("clientId") UUID clientId,
                      @Param("owner") String owner,
                      Pageable pageable);

    long countByClientId(UUID clientId);

    // Какие из этих заявок уже разобраны в сделку. Одним запросом на страницу,
    // а не по запросу на строку: список заявок иначе превращается в N+1.
    List<Deal> findByLeadIdIn(Collection<UUID> leadIds);
}
