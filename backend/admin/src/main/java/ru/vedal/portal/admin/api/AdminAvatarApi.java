package ru.vedal.portal.admin.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MultipartFile;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.ConflictException;
import ru.vedal.portal.common.PayloadTooLargeException;
import ru.vedal.portal.iam.StaffAvatars;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/**
 * Портрет сотрудника: свой — меняешь, чужой — только смотришь.
 *
 * ————— почему у своего портрета нет логина в адресе —————
 *
 * Требование «сотрудник меняет только свой портрет» можно было выполнить
 * проверкой: взять логин из пути и сравнить с логином из токена. Здесь оно
 * выполнено иначе — тем, что ЧУЖОЙ ЛОГИН НЕГДЕ НАЗВАТЬ. Двери правки
 * принимают только файл, а кому он принадлежит, решает токен.
 *
 * Разница не в стиле. Проверку можно забыть в одной из трёх дверей, и
 * забытая она молчит; здесь забывать нечего, потому что параметра нет.
 * Ровно тем же способом закрыт /session: он не спрашивает, чью сессию
 * показать.
 *
 * ————— почему чтение живёт под /staff —————
 *
 * Кружок с портретом стоит не только в своём профиле: он помечает автора
 * записи в журнале, ответственного у сделки, человека в справочнике. Это
 * чтение справочника сотрудников, и правило доступа у него то же — любая
 * портальная роль. Заведи мы для него отдельную ветку адресов, правило
 * пришлось бы написать второй раз.
 *
 * ————— почему картинка отдаётся дверью, а не бакетом —————
 *
 * Контур закрытый. Бакет `vedal-media` открыт на чтение анонимно — это его
 * назначение, снимки изделий и так видны на сайте, — и лицо сотрудника,
 * положенное туда, оказалось бы опубликовано. Плюс к тому у сервисного
 * ключа прав на этот бакет нет вовсе (issue #37). Разбор целиком —
 * в миграции V35.
 */
@RestController
@RequestMapping("/api/admin/v1")
@Tag(name = "Админка: портрет")
@SecurityRequirement(name = "keycloak")
public class AdminAvatarApi {

    /**
     * Сколько браузер держит портрет, не переспрашивая.
     *
     * Пять минут, а не сутки: портрет меняют редко, но увидеть замену
     * человек хочет сразу. Дальше работает ETag — переспрос стоит 304
     * без тела, и после первого раза байты не едут вовсе.
     */
    private static final Duration CACHE = Duration.ofMinutes(5);

    @Schema(name = "AdminMyAvatar", description = "Что стало с портретом после правки.")
    public record MyAvatar(
            @Schema(description = "Сторона хранимого портрета в точках.") int width,
            @Schema(description = "Размер хранимого JPEG в байтах.") int size,
            @Schema(description = "Когда портрет заменили.") Instant updatedAt) {}

    private final StaffAvatars avatars;
    private final AuditLog audit;

    public AdminAvatarApi(StaffAvatars avatars, AuditLog audit) {
        this.avatars = avatars;
        this.audit = audit;
    }

    @Operation(summary = "Портрет сотрудника",
            description = """
                    Отдаёт JPEG 256×256 или 404, если портрета нет. 404 здесь —
                    не поломка: у большинства сотрудников портрета нет, и админка
                    рисует на его месте кружок с первой буквой логина.

                    Открыто любой портальной роли: кружок с портретом помечает
                    автора записи в журнале и ответственного у сделки, а не
                    только вас самих.
                    """)
    @GetMapping("/staff/{login}/avatar")
    @Transactional
    public ResponseEntity<byte[]> portrait(@PathVariable String login,
                                           Authentication who,
                                           WebRequest request) {
        var actor = Actor.of(who);

        // Свой портрет читается со сверкой владельца, чужой — без неё.
        //
        // Это не оптимизация, а единственное место, где сверка вообще
        // возможна: `sub` есть только у того, кто пришёл с токеном.
        // Оболочка спрашивает свой портрет на каждой странице, поэтому
        // портрет, оставшийся от прежнего владельца логина, стирается
        // при первом же входе нового. Подробности — в StaffAvatars.
        var found = login.equals(actor)
                ? avatars.mine(actor, Actor.subjectOf(who))
                : avatars.of(login);

        if (found.isEmpty()) return ResponseEntity.notFound().build();
        var portrait = found.get();

        // Кавычки — часть формата ETag (RFC 9110). Без них заголовок
        // формально неверен, и посредник вправе его выбросить.
        var tag = "\"" + portrait.etag() + "\"";
        if (request.checkNotModified(tag)) {
            // 304 уже проставлен: тело не нужно, у браузера оно есть.
            return ResponseEntity.status(304).eTag(tag).build();
        }

        return ResponseEntity.ok()
                .eTag(tag)
                // private — портрет нельзя класть в общий кеш посредника:
                // закрытый контур, и один сотрудник не должен получить его
                // из кеша вместо своего.
                .cacheControl(CacheControl.maxAge(CACHE).cachePrivate())
                .contentType(MediaType.parseMediaType(portrait.contentType()))
                .body(portrait.bytes());
    }

    @Operation(summary = "Поставить или заменить свой портрет",
            description = """
                    Принимает JPEG или PNG до 2 МБ, стороной от 64 до 4096 точек.
                    Хранится не присланный файл, а собранный из его точек
                    JPEG 256×256: всё, что ехало рядом с картинкой, включая EXIF
                    с координатами съёмки, до хранилища не доезжает.

                    Формат определяется по содержимому файла. Расширение и
                    заголовок `Content-Type` пишет тот, кто грузит, и в проверке
                    они не участвуют.

                    Чей это портрет, решает токен: логина в адресе нет, и назвать
                    чужой негде.
                    """)
    @PostMapping(value = "/profile/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public MyAvatar replace(@RequestPart("file") MultipartFile file, Authentication who) {
        if (file == null || file.isEmpty()) throw new ConflictException("Файл не выбран");

        // Проверка по объявленному размеру — до чтения тела в память.
        // Настоящий обрыв большого тела стоит выше, в разборе multipart
        // (spring.servlet.multipart), и он общий на весь портал — 20 МБ.
        // Здесь второй предел, свой: портрет и датащит не одна вещь.
        if (file.getSize() > StaffAvatars.maxUploadBytes()) {
            throw new PayloadTooLargeException("Портрет больше разрешённых "
                    + StaffAvatars.maxUploadBytes() / 1024 / 1024 + " МБ (в файле "
                    + Math.ceilDiv(file.getSize(), 1024L * 1024L) + " МБ)");
        }

        byte[] raw;
        try {
            raw = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        var actor = Actor.of(who);
        StaffAvatars.Stored portrait;
        try {
            portrait = avatars.replace(actor, Actor.subjectOf(who), raw);
        } catch (StaffAvatars.Rejected e) {
            // Отказ — разговор с человеком, а не пятисотка: «это не картинка»,
            // «слишком мелкая», «повреждена».
            throw new ConflictException(e.getMessage());
        } catch (StaffAvatars.TooLarge e) {
            throw new PayloadTooLargeException(e.getMessage());
        }

        // В одной транзакции с самим портретом: @Transactional на методе,
        // AuditLog.record с propagation = MANDATORY. Порознь они разошлись бы
        // ровно в тот момент, когда журнал нужен, — при отказе на записи.
        audit.record(actor, "profile.avatar.set", "staff", actor,
                Map.of("размер", portrait.bytes().length,
                        "сторона", portrait.width(),
                        "прислано", file.getSize()));

        return new MyAvatar(portrait.width(), portrait.bytes().length, portrait.updatedAt());
    }

    @Operation(summary = "Убрать свой портрет",
            description = """
                    Возвращает кружок с первой буквой логина. Портрета не было —
                    ответ тот же: убирать нечего, и отказ здесь означал бы,
                    что кнопка иногда ломается без причины.
                    """)
    @DeleteMapping("/profile/avatar")
    @Transactional
    public ResponseEntity<Void> clear(Authentication who) {
        var actor = Actor.of(who);
        if (avatars.clear(actor)) {
            // Только когда портрет был. Запись «убрал портрет» о человеке,
            // у которого его не было, — событие, которого не случилось.
            audit.record(actor, "profile.avatar.clear", "staff", actor, Map.of());
        }
        return ResponseEntity.noContent().build();
    }
}
