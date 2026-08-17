package ru.vedal.portal.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

// Одно сообщение в разговоре.
//
// Автора три, а не два, и это не деталь модели. Посетитель обязан видеть,
// машина ему ответила или человек: выдать ответ поиска за консультацию
// сотрудника нельзя ни при каких обстоятельствах. Из этого же следует, что
// «наш/не наш» одним флагом здесь не обойтись.
//
// Сообщения не правятся. Переписка, которую можно исправить задним числом,
// перестаёт быть историей ровно тогда, когда она понадобилась, — тем же
// правилом живут interaction в CRM и журнал аудита.
@Entity
@Table(name = "chat_message")
public class ChatMessage {

    public static final String VISITOR = "visitor";
    public static final String ASSISTANT = "assistant";
    public static final String STAFF = "staff";

    @Id
    private UUID id;

    @Column(name = "conversation_id")
    private UUID conversationId;

    private String author;

    // Логин сотрудника — только у author = staff.
    private String actor;

    private String body;

    // Источники, которыми ответила Урания. Снимок, а не ссылки на живые
    // сущности: изделие могли переименовать или снять с публикации, а
    // переписка обязана остаться такой, какой её видел человек.
    //
    // Аннотация обязательна: без неё ddl-auto=validate ждёт varchar и роняет
    // старт приложения на jsonb. Тот же приём, что у audit_entry.payload.
    @JdbcTypeCode(SqlTypes.JSON)
    private String sources;

    // Когда сообщение прочитано противоположной стороной. Ставится, когда
    // адресат читает ленту: отдельной кнопки «прочитано» не бывает,
    // а отдельный запрос от клиента можно не отправить.
    @Column(name = "read_at")
    private Instant readAt;

    private Instant at = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getConversationId() { return conversationId; }
    public void setConversationId(UUID conversationId) { this.conversationId = conversationId; }
    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getSources() { return sources; }
    public void setSources(String sources) { this.sources = sources; }
    public Instant getReadAt() { return readAt; }
    public void setReadAt(Instant readAt) { this.readAt = readAt; }
    public Instant getAt() { return at; }
    public void setAt(Instant at) { this.at = at; }
}
