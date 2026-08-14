package ru.vedal.portal.crm;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    Optional<Client> findByInn(String inn);

    Optional<Client> findByExternalId(String externalId);

    // Постранично: клиентская база растёт без предела, и «показать всех»
    // однажды означает выгрузить все персональные данные одним запросом.
    Page<Client> findAllByOrderByNameAsc(Pageable pageable);

    // Поиск по названию и реквизитам. lower() под индексом client_name_idx;
    // по ИНН ищут точным вводом, поэтому здесь тот же like — менеджер вводит
    // первые цифры и видит совпадения.
    @Query("""
            select c from Client c
            where lower(c.name) like lower(concat('%', :query, '%'))
               or c.inn like concat(:query, '%')
            order by c.name asc
            """)
    Page<Client> search(@Param("query") String query, Pageable pageable);
}
