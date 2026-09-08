package ru.vedal.portal.admin.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import ru.vedal.portal.PostgresTestBase;
import ru.vedal.portal.audit.AuditEntryRepository;
import ru.vedal.portal.iam.StaffAvatars;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Портрет сотрудника.
 *
 * Проверяется не «загрузилось», а четыре свойства, каждое из которых
 * ломается тихо:
 *
 *   1. хранится НЕ ТО, ЧТО ПРИСЛАЛИ, а перекодированный JPEG — иначе
 *      всё, что ехало рядом с картинкой, доедет до браузера коллеги;
 *   2. отсутствие портрета — это 404, а не пустая картинка: на его месте
 *      админка рисует кружок с буквой, и «пусто» она должна отличать
 *      от «сломалось»;
 *   3. чужой портрет менять негде — двери с логином в адресе не существует;
 *   4. переиспользованный логин не наследует чужое лицо.
 */
@AutoConfigureMockMvc
class AdminAvatarApiTest extends PostgresTestBase {

    private static final String СВОЙ = "/api/admin/v1/profile/avatar";
    private static final String ЧУЖОЙ = "/api/admin/v1/staff/koltsova/avatar";
    private static final String МОЙ_СНИМОК = "/api/admin/v1/staff/editor/avatar";

    @Autowired
    MockMvc mvc;

    @Autowired
    AuditEntryRepository audit;

    @Autowired
    StaffAvatars avatars;

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void portraitTakesThePlaceOfTheLetterCircle() throws Exception {
        mvc.perform(multipart(СВОЙ).file(part(png(400, 300))))
                .andExpect(status().isOk())
                // Хранится квадрат стороной 256 — независимо от того,
                // что прислали: кружок в интерфейсе всё равно квадратный.
                .andExpect(jsonPath("$.width").value(256));

        var ответ = mvc.perform(get(МОЙ_СНИМОК))
                .andExpect(status().isOk())
                .andReturn().getResponse();

        assertThat(ответ.getContentType()).isEqualTo("image/jpeg");
        assertThat(ответ.getHeader(HttpHeaders.ETAG)).isNotBlank();
        // Кеш только личный: закрытый контур, и портрет одного сотрудника
        // не должен приехать другому из общего кеша посредника.
        assertThat(ответ.getHeader(HttpHeaders.CACHE_CONTROL)).contains("private");
        assertThat(jpeg(ответ.getContentAsByteArray())).isTrue();

        assertThat(audit.findAll()).anyMatch(e -> e.getAction().equals("profile.avatar.set")
                && e.getActor().equals("editor"));
    }

    // Главная проверка файла. Присланное не хранится вовсе: портал собирает
    // новый JPEG из точек, и довесок после конца картинки — а с ним EXIF,
    // комментарии и любая начинка полиглота — до хранилища не доезжает.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void whatIsStoredIsNotWhatWasSent() throws Exception {
        var метка = "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8);
        var картинка = png(300, 300);
        var сПривеском = new byte[картинка.length + метка.length];
        System.arraycopy(картинка, 0, сПривеском, 0, картинка.length);
        System.arraycopy(метка, 0, сПривеском, картинка.length, метка.length);

        mvc.perform(multipart(СВОЙ).file(part(сПривеском))).andExpect(status().isOk());

        var хранимое = mvc.perform(get(МОЙ_СНИМОК)).andReturn().getResponse()
                .getContentAsByteArray();

        assertThat(jpeg(хранимое)).as("хранится JPEG, а не присланный PNG").isTrue();
        assertThat(contains(хранимое, метка))
                .as("довесок после конца картинки не должен пережить перекодирование")
                .isFalse();
    }

    // Расширение и Content-Type пишет тот, кто грузит. Решают байты.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void aFileNamedLikeAPictureIsStillNotAPicture() throws Exception {
        var подделка = new MockMultipartFile("file", "portrait.jpg", "image/jpeg",
                "GIF89a это вообще не картинка".getBytes(StandardCharsets.UTF_8));

        mvc.perform(multipart(СВОЙ).file(подделка)).andExpect(status().isConflict());
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void anIconStretchedIntoAPortraitIsRefused() throws Exception {
        mvc.perform(multipart(СВОЙ).file(part(png(32, 32)))).andExpect(status().isConflict());
    }

    // Отсутствие портрета — обычное состояние: он есть не у всех, и админка
    // рисует на его месте кружок с буквой. Это 404, а не пустое тело.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void noPortraitIsNotAFailure() throws Exception {
        mvc.perform(get(ЧУЖОЙ)).andExpect(status().isNotFound());
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void theSameBytesComeBackAsNotModified() throws Exception {
        mvc.perform(multipart(СВОЙ).file(part(png(300, 300)))).andExpect(status().isOk());

        var etag = mvc.perform(get(МОЙ_СНИМОК)).andReturn().getResponse()
                .getHeader(HttpHeaders.ETAG);

        mvc.perform(get(МОЙ_СНИМОК).header(HttpHeaders.IF_NONE_MATCH, etag))
                .andExpect(status().isNotModified());
    }

    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void removingThePortraitBringsBackTheLetterCircle() throws Exception {
        mvc.perform(multipart(СВОЙ).file(part(png(300, 300)))).andExpect(status().isOk());

        mvc.perform(delete(СВОЙ)).andExpect(status().isNoContent());
        mvc.perform(get(МОЙ_СНИМОК)).andExpect(status().isNotFound());

        assertThat(audit.findAll()).anyMatch(e -> e.getAction().equals("profile.avatar.clear"));
    }

    // Кнопка не должна ломаться без причины: убирать нечего — значит убрано.
    // А вот записи в журнале быть не должно: событие не случилось.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void removingWhatWasNotThereIsNotAnEvent() throws Exception {
        mvc.perform(delete(СВОЙ)).andExpect(status().isNoContent());

        assertThat(audit.findAll()).noneMatch(e -> e.getAction().equals("profile.avatar.clear"));
    }

    // Требование «сотрудник меняет только свой портрет» выполнено формой
    // адреса, а не проверкой: назвать чужой логин негде. Тест сторожит
    // именно это — появившаяся дверь с логином в пути его уронит.
    @Test
    @WithMockUser(username = "editor", roles = "PORTAL_ADMIN")
    void thereIsNoDoorToSomeoneElsesPortrait() throws Exception {
        mvc.perform(multipart(ЧУЖОЙ).file(part(png(300, 300))))
                .andExpect(status().isMethodNotAllowed());
        mvc.perform(delete(ЧУЖОЙ)).andExpect(status().isMethodNotAllowed());
    }

    // Учётную запись удалили, логин выдали другому человеку. Портрет прежнего
    // владельца не должен стать лицом нового: `sub` в Keycloak не меняется,
    // и несовпадение стирает строку при первом же входе.
    //
    // Проверяется на порту, а не через дверь: @WithMockUser токена не несёт,
    // а `sub` бывает только у токена.
    @Test
    void aReusedLoginDoesNotInheritSomeoneElsesFace() throws Exception {
        avatars.replace("koltsova", "sub-прежнего", png(300, 300));
        assertThat(avatars.of("koltsova")).isPresent();

        assertThat(avatars.mine("koltsova", "sub-нового"))
                .as("новый владелец логина не получает чужой портрет")
                .isEmpty();
        assertThat(avatars.of("koltsova"))
                .as("и чужого портрета больше нет ни у кого")
                .isEmpty();
    }

    // Запасной режим vedal.iam.mode=local токена не выдаёт, и `sub` там
    // не бывает. Сравнивать нечего — и портал ничего не стирает.
    @Test
    void withoutASubjectNothingIsCompared() throws Exception {
        avatars.replace("editor", null, png(300, 300));

        assertThat(avatars.mine("editor", null)).isPresent();
        assertThat(avatars.mine("editor", "sub-откуда-то")).isPresent();
    }

    private static MockMultipartFile part(byte[] bytes) {
        // Имя и заявленный тип нарочно правдоподобные: проверка не должна
        // на них опираться ни в одну сторону.
        return new MockMultipartFile("file", "portrait.png", "image/png", bytes);
    }

    private static byte[] png(int width, int height) throws Exception {
        var image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics();
        try {
            g.setColor(Color.BLUE);
            g.fillRect(0, 0, width, height);
        } finally {
            g.dispose();
        }
        var out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private static boolean jpeg(byte[] bytes) {
        return bytes.length > 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8;
    }

    private static boolean contains(byte[] haystack, byte[] needle) {
        outer:
        for (int i = 0; i <= haystack.length - needle.length; i++) {
            for (int j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) continue outer;
            }
            return true;
        }
        return false;
    }
}
