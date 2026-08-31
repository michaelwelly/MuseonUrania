package ru.vedal.portal.crm;

import java.util.Optional;
import java.util.UUID;

// Контакты заявки для соседей. Нужен, чтобы персональные данные не уезжали
// в payload события: событие несёт только идентификатор, а адрес получателя
// потребитель запрашивает здесь. Иначе ПДн окажутся в топиках Kafka, то есть
// в открытом контуре.
public interface LeadContacts {

    // Номер здесь потому, что он попадает в письмо: и клиенту, и менеджеру
    // сообщают, какое обращение принято, а идентификатор для человека
    // не значит ничего.
    record Contact(UUID id, String number, String email, String form, String productSlug) {}

    Optional<Contact> contact(UUID leadId);
}
