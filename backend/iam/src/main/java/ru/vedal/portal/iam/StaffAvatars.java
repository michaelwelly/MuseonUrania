package ru.vedal.portal.iam;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Портреты сотрудников.
 *
 * ————— чей это портрет и кто хозяин учётной записи —————
 *
 * Учётная запись живёт в Keycloak: логин, имя и роли приезжают в токене,
 * и портал их только читает. Портрета в токене нет — консоль Keycloak умеет
 * хранить его в атрибуте пользователя, но это требует manage-users каждому,
 * кто хочет сменить себе картинку, а manage-users — право менять кого угодно
 * (цена уже названа в StaffDirectory). Поэтому портрет — собственное
 * хранение портала, привязанное к логину.
 *
 * Отсюда три последствия, и все три названы вслух, а не оставлены на потом.
 *
 * 1. ПЕРЕИМЕНОВАНИЕ. Логин сменили в Keycloak — портрет остаётся под старым,
 *    и человек снова видит кружок с буквой, пока не загрузит его заново.
 *    Так же ведут себя ВСЕ логины в портале: ответственный у заявки и сделки,
 *    дежурный в графике, actor в журнале. Ни у одного из них нет внешнего
 *    ключа, и быть не может — таблицы сотрудников у портала нет. Чинить это
 *    для одной колонки значит завести второй порядок вещей рядом с общим.
 *
 * 2. УДАЛЕНИЕ. Строка остаётся сиротой — ровно как строка журнала за
 *    уволившимся. Это не мусор: портрет рядом со старой записью журнала
 *    правилен, там действительно был тот человек. Показывать его негде,
 *    кроме журнала: справочник такого логина больше не отдаёт.
 *
 * 3. ПЕРЕИСПОЛЬЗОВАНИЕ ЛОГИНА — единственный случай, где сирота опасна:
 *    новый сотрудник с освободившимся логином унаследовал бы чужое лицо,
 *    и никто бы этого не заметил. Против него стоит колонка `subject` —
 *    `sub` из токена, который в Keycloak не меняется никогда. Портрет,
 *    чей subject не совпал с токеном владельца, стирается при первом же
 *    его входе: оболочка спрашивает свой портрет на каждой странице.
 *
 * Полной эта защита не является, и притворяться ей не надо: пока новый
 * владелец логина не вошёл, коллега видит рядом с его логином старое лицо.
 * Закрыть щель до конца можно было бы, спрашивая `sub` каждого логина
 * в Keycloak, — то есть поход в Keycloak на каждый кружок в журнале.
 */
@Service
public class StaffAvatars {

    /** Портрет, каким он лежит в базе и уходит браузеру. */
    public record Stored(String login, String contentType, byte[] bytes,
                         int width, int height, String etag, Instant updatedAt) {}

    /**
     * Отказ, который надо сказать человеку словами: не картинка, повреждена,
     * слишком мелкая, слишком крупная.
     *
     * Своё исключение, а не ConflictException из common: модуль iam
     * от common не зависит, и тащить сюда общий модуль ради одного класса
     * значит связать провайдера входа со всем остальным приложением.
     * Переводит его в отказ та дверь, которая порт зовёт, — так же
     * поступает StaffDirectory.Rejected.
     */
    public static class Rejected extends RuntimeException {
        public Rejected(String message) {
            super(message);
        }
    }

    /** Отдельно от Rejected: у двери это 413, а не 409. */
    public static class TooLarge extends RuntimeException {
        public TooLarge(String message) {
            super(message);
        }
    }

    private final StaffAvatarRepository avatars;

    public StaffAvatars(StaffAvatarRepository avatars) {
        this.avatars = avatars;
    }

    /** Наибольший размер присланного файла — дверь называет его в отказе. */
    public static long maxUploadBytes() {
        return AvatarImage.MAX_UPLOAD_BYTES;
    }

    /** Портрет сотрудника по логину. Пусто — значит рисуется кружок с буквой. */
    @Transactional(readOnly = true)
    public Optional<Stored> of(String login) {
        return avatars.findById(login).map(StaffAvatars::stored);
    }

    /**
     * Свой портрет — с проверкой, что он действительно свой.
     *
     * Сверка `subject` живёт здесь, а не у двери: она нужна на каждом
     * обращении владельца к своему портрету, а таких обращений три —
     * посмотреть, заменить, убрать. Забыть её у одной из трёх дверей
     * значит оставить дыру, ради которой колонка и заводилась.
     *
     * Пустой subject с любой стороны — не повод стирать: в запасном режиме
     * `vedal.iam.mode=local` его не бывает вовсе, и сравнивать нечего.
     */
    @Transactional
    public Optional<Stored> mine(String login, String subject) {
        var found = avatars.findById(login);
        if (found.isEmpty()) return Optional.empty();

        var avatar = found.get();
        if (subject != null && avatar.getSubject() != null
                && !subject.equals(avatar.getSubject())) {
            // Логин тот же, учётная запись другая. Это не «чужой портрет
            // показался» — это чужое лицо, которое вот-вот стало бы вашим.
            avatars.delete(avatar);
            return Optional.empty();
        }
        return Optional.of(stored(avatar));
    }

    /**
     * Заменить свой портрет.
     *
     * Замена, а не «добавить»: портрет у человека один, и второй означал бы
     * вопрос, какой из них показывать. Прежние байты пропадают, и это
     * намеренно — истории портретов портал не ведёт.
     */
    @Transactional
    public Stored replace(String login, String subject, byte[] raw) {
        var portrait = AvatarImage.normalize(raw);

        var avatar = avatars.findById(login).orElseGet(StaffAvatar::new);
        avatar.setLogin(login);
        avatar.setSubject(subject);
        avatar.setContentType(AvatarImage.CONTENT_TYPE);
        avatar.setBytes(portrait.bytes());
        avatar.setWidth(portrait.width());
        avatar.setHeight(portrait.height());
        avatar.setEtag(digest(portrait.bytes()));
        avatar.setUpdatedAt(Instant.now());

        return stored(avatars.save(avatar));
    }

    /**
     * Убрать свой портрет.
     *
     * @return был ли он вообще. Дверь по этому признаку решает, писать ли
     *         в журнал: запись «убрал портрет» о человеке, у которого его
     *         не было, — событие, которого не случилось.
     */
    @Transactional
    public boolean clear(String login) {
        var found = avatars.findById(login);
        found.ifPresent(avatars::delete);
        return found.isPresent();
    }

    private static Stored stored(StaffAvatar avatar) {
        return new Stored(avatar.getLogin(), avatar.getContentType(), avatar.getBytes(),
                avatar.getWidth(), avatar.getHeight(), avatar.getEtag(), avatar.getUpdatedAt());
    }

    /**
     * SHA-256 хранимых байтов — он же ETag.
     *
     * Не время правки: две загрузки одного и того же файла дали бы разный
     * ETag, и браузер перекачал бы то, что у него уже есть. Хеш содержимого
     * отвечает на настоящий вопрос — «те же это байты или другие».
     */
    private static String digest(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 обязателен для любой JVM. Если его нет, сломано что-то,
            // о чём надо узнать здесь, а не получить кружок без картинки.
            throw new IllegalStateException("В этой сборке JVM нет SHA-256", e);
        }
    }
}
