package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.vedal.portal.chat.ChatPrivacy;
import ru.vedal.portal.crm.PersonalData;

import java.util.Map;
import java.util.UUID;

// Уничтожение персональных данных по обращению субъекта.
//
// Дверь одна и только через админку: обращение приходит сотруднику — письмом,
// звонком, бумагой, — он его проверяет и исполняет. Публичной ручки «удалите
// меня» здесь нет и быть не может: она позволила бы любому, кто угадал
// идентификатор заявки, стереть чужое обращение вместе с историей.
//
// DELETE на подресурс, а не POST: удаляются именно персональные данные,
// а не заявка. Заявка остаётся — она единица учёта, и аналитика по источнику
// и кампании считается по ней и после.
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: персональные данные")
@SecurityRequirement(name = "keycloak")
public class AdminPrivacyApi {

    private final PersonalData privacy;
    private final ChatPrivacy chats;

    public AdminPrivacyApi(PersonalData privacy, ChatPrivacy chats) {
        this.privacy = privacy;
        this.chats = chats;
    }

    @Operation(summary = "Уничтожить персональные данные заявки",
            description = """
                    Стирает имя, телефон, почту и текст обращения, а также тему и тело
                    всех записей истории по этой заявке. Организация не трогается:
                    юридическое лицо персональными данными не является.

                    Заявка остаётся: форма, источник, язык, кампания, статус и время
                    считаются в аналитике и после — опознать по ним человека нельзя.
                    Удалить строку было бы нельзя, не порвав ссылку из сделки, разрез
                    аналитики и запись в неизменяемом журнале.

                    Повторный вызов ничего не меняет и отвечает `already`: обращение
                    приходит дважды чаще, чем кажется.
                    """)
    @ApiResponse(responseCode = "200", description = "Уничтожено либо уже было уничтожено.")
    @ApiResponse(responseCode = "404", description = "Заявки нет.")
    @DeleteMapping("/leads/{id}/personal-data")
    public Map<String, String> eraseLead(@PathVariable UUID id, Authentication authentication) {
        var actor = Actor.of(authentication);
        var erased = privacy.eraseLead(id, PersonalData.Basis.REQUEST, actor);

        // Разговор, из которого выросла заявка, стирается вместе с ней.
        // Человек подаёт одно обращение, а данные его лежат в двух местах:
        // исполнить только половину — значит не исполнить.
        //
        // Делается это здесь, а не внутри PersonalData: crm и chat друг о друге
        // не знают, и связывать их ради одной операции значит потерять
        // возможность вынести чат отдельно. Дверь знает про оба — ей и сшивать.
        var talks = chats.eraseByLead(id, PersonalData.Basis.REQUEST.text(), actor);

        return Map.of("result", erased ? "erased" : "already",
                "conversations", String.valueOf(talks));
    }

    @Operation(summary = "Уничтожить персональные данные разговора",
            description = """
                    Стирает тела всех сообщений — и посетителя, и сотрудника, и Урании:
                    сотрудник в ответе повторяет имя и телефон чаще, чем кажется,
                    а ответ ассистента цитирует вопрос.

                    Сама лента остаётся: по ней видно, что разговор был, сколько длился
                    и чем кончился. Удалить его целиком значит потерять след работы
                    сотрудника — а работа была, и за неё отвечали.
                    """)
    @ApiResponse(responseCode = "200", description = "Уничтожено либо уже было уничтожено.")
    @ApiResponse(responseCode = "404", description = "Разговора нет.")
    @DeleteMapping("/chats/{id}/personal-data")
    public Map<String, String> eraseConversation(@PathVariable UUID id,
                                                 Authentication authentication) {
        var erased = chats.erase(id, PersonalData.Basis.REQUEST.text(), Actor.of(authentication));
        return Map.of("result", erased ? "erased" : "already");
    }

    @Operation(summary = "Уничтожить персональные данные клиента",
            description = """
                    Стирает почту, телефон и заметку. Наименование — только у частного
                    лица: у организации это её название, и стерев его мы получили бы
                    сделки, подписанные словом «удалено».

                    История переписки по клиенту стирается вместе с карточкой: там
                    персональных данных обычно больше, чем в самих полях.
                    """)
    @ApiResponse(responseCode = "200", description = "Уничтожено либо уже было уничтожено.")
    @ApiResponse(responseCode = "404", description = "Клиента нет.")
    @DeleteMapping("/clients/{id}/personal-data")
    public Map<String, String> eraseClient(@PathVariable UUID id, Authentication authentication) {
        var erased = privacy.eraseClient(id, PersonalData.Basis.REQUEST, Actor.of(authentication));
        return Map.of("result", erased ? "erased" : "already");
    }
}
