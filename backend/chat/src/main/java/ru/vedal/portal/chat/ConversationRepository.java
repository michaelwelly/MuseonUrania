package ru.vedal.portal.chat;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    // Открытый разговор у ключа один — это закреплено частичным уникальным
    // индексом conversation_visitor_open_idx. Второй означал бы, что посетитель
    // пишет в одно окно, а сотрудник отвечает в другое.
    Optional<Conversation> findByVisitorKeyAndStatusNot(String visitorKey, String status);

    // Очередь сотрудника: кто ждёт живого ответа дольше всех. Сортировка
    // по возрастанию времени последнего сообщения — первым тот, кто ждёт дольше.
    Page<Conversation> findByStatusOrderByLastAtAsc(String status, Pageable pageable);

    // Список разговоров с отбором по ответственному. Нужен карточке
    // сотрудника: «сколько разговоров на человеке» — вопрос, на который
    // до сих пор было нечем ответить, и на его месте стоял прочерк.
    //
    // Значение «-» означает «без ответственного» — та же договорённость,
    // что у заявок и сделок. У разговоров она значит не то же, что там:
    // разговор без ответственного не ждёт уточнения, его просто ещё никто
    // не взял. Но вопрос менеджера тот же самый, и разные слова для одного
    // вопроса в трёх списках — это три места, где потом чинить.
    @Query("""
            select c from Conversation c
            where (:owner is null
                   or (:owner = '-' and c.owner is null)
                   or c.owner = :owner)
            order by c.lastAt desc
            """)
    Page<Conversation> filter(@Param("owner") String owner, Pageable pageable);

    // Разговор, из которого выросла заявка. Нужен обезличиванию: человек
    // просит удалить свои данные один раз, а лежат они в двух местах —
    // в заявке и в переписке, которая её породила.
    //
    // List, а не Optional: связь односторонняя и уникальным индексом не
    // закрыта, а обезличивание — не то место, где стоит падать на втором
    // совпадении вместо того, чтобы обработать оба.
    List<Conversation> findByLeadId(UUID leadId);
}
