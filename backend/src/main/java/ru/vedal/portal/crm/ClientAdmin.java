package ru.vedal.portal.crm;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ru.vedal.portal.common.PageView;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Дверь модуля к клиентской базе.
//
// Это самые чувствительные данные портала: «клиентская база не живёт в почте»
// — прямая причина писать CRM внутри контура, а не покупать её. Наружу отсюда
// не уходит ничего: ни в публичное API, ни в топики, ни в письма.
public interface ClientAdmin {

    // Закрыто проверкой в схеме. Продублировано, чтобы форма нарисовала
    // выбор, а не свободное поле.
    List<String> KINDS = List.of("company", "person");

    @Schema(name = "AdminClientRow", description = "Строка списка клиентов.")
    record ClientRow(UUID id, String name, String kind, String inn, String city, String owner,

                     @Schema(description = "Сколько сделок заведено по этому клиенту.")
                     long deals,

                     Instant updatedAt) {}

    @Schema(name = "AdminClient", description = """
            Карточка клиента вместе с контактами и реквизитами. Контакты —
            персональные данные: дверь закрыта аутентификацией, и каждое
            изменение попадает в журнал.
            """)
    record ClientView(UUID id,

                      @Schema(description = "Версия карточки. Её надо вернуть в форме правки, "
                              + "иначе сохранение затрёт чужую правку вслепую.")
                      long version,

                      String name, String kind, String inn, String kpp,

                      @Schema(description = "Идентификатор контрагента во внешней системе. "
                              + "Заведён под будущий обмен с 1С; сам обмен не подтверждён.",
                              nullable = true)
                      String externalId,

                      String country, String city, String email, String phone,
                      String note, String owner,
                      Instant createdAt, Instant updatedAt) {}

    @Schema(name = "AdminClientForm", description = "Форма карточки клиента.")
    record ClientForm(

            @Schema(description = "Версия прочитанной карточки. При создании не нужна.",
                    nullable = true)
            Long version,

            @Schema(description = "Наименование организации или ФИО.",
                    example = "Областной перинатальный центр")
            @NotBlank(message = "Укажите наименование")
            @Size(max = 300) String name,

            @Schema(allowableValues = {"company", "person"}, example = "company")
            @NotBlank
            @Pattern(regexp = "company|person", message = "Клиент — организация или человек")
            String kind,

            @Schema(description = "ИНН: 10 цифр у организации, 12 у предпринимателя.",
                    example = "5406826069", nullable = true)
            @Pattern(regexp = "^$|^\\d{10}$|^\\d{12}$", message = "ИНН — 10 или 12 цифр")
            String inn,

            @Schema(description = "КПП: 9 цифр.", example = "540601001", nullable = true)
            @Pattern(regexp = "^$|^\\d{9}$", message = "КПП — 9 цифр")
            String kpp,

            @Size(max = 200) String externalId,
            @Size(max = 100) String country,
            @Size(max = 200) String city,

            @Schema(description = "Почта для переписки.", nullable = true)
            @Email(message = "Проверьте адрес почты")
            String email,

            @Size(max = 100) String phone,
            String note,

            @Schema(description = "Логин ответственного. Пусто — снять ответственного.",
                    nullable = true)
            @Size(max = 200) String owner) {}

    PageView<ClientRow> clients(String query, int page, int size);

    ClientView client(UUID id);

    ClientView create(ClientForm form, String actor);

    ClientView update(UUID id, ClientForm form, String actor);
}
