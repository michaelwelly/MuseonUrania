package ru.vedal.portal.iam;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Image;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Приведение присланного файла к портрету.
 *
 * ————— почему по содержимому, а не по расширению —————
 *
 * Портрет показывается другим сотрудникам: загруженное одним человеком
 * отдаётся браузеру другого. Расширение и заголовок Content-Type пишет тот,
 * кто грузит; верить им значит верить загружающему ровно в том месте,
 * где проверка и нужна.
 *
 * Поэтому решают байты. Сначала подпись формата (три байта JPEG, восемь
 * байт PNG), затем разбор картинки декодером: файл, который не разбирается
 * в растр, портретом не является, чем бы он ни назывался.
 *
 * ————— почему перекодирование, а не проверка —————
 *
 * Главная защита не в проверках, а в том, что наружу уходят НЕ ТЕ БАЙТЫ,
 * которые прислали. Портал хранит результат собственного кодировщика,
 * собранный из пикселей. Всё, что ехало рядом с пикселями — довесок после
 * конца картинки, комментарий с разметкой, полиглот, который одновременно
 * и картинка, и что-то ещё, — до хранилища не доезжает вовсе: у нового
 * файла этого просто нет.
 *
 * Побочно снимается EXIF, и это не мелочь: в снимке с телефона лежат
 * координаты съёмки. Портрет сотрудника с координатами его квартиры —
 * персональные данные, которых никто не собирался собирать.
 *
 * ————— почему SVG нельзя —————
 *
 * По той же причине, по которой его нет у снимков изделий (AdminMediaApi):
 * SVG — это XML, он умеет нести внутри себя script, и «перекодировать» его
 * в растр значит завести в портале рисовальщик чужой разметки.
 *
 * ————— почему такие числа —————
 *
 * Хранится 256×256: кружок в интерфейсе бывает от 22 до 104 точек, и 256
 * покрывает самый крупный с запасом на экран двойной плотности.
 *
 * Принимается файл до 2 МБ. Общий предел портала — 20 МБ, это рабочий
 * размер датащита с иллюстрациями; для портрета он не просто велик,
 * а означает другую таблицу: двадцать мегабайт на человека — это файловое
 * хранилище, а не колонка. Два мегабайта с запасом покрывают снимок,
 * сохранённый телефоном или обрезанный в редакторе.
 *
 * Сторона исходника — от 64 до 4096. Нижняя граница отсекает иконку,
 * растянутую в кружок до мыла. Верхняя — не про качество: разобранная
 * картинка живёт в памяти несжатой, и 4096×4096 это уже 67 МБ на одну
 * загрузку. Проверяется она ДО разбора, по заголовку файла: иначе проверка
 * стоит после того, от чего защищает.
 */
final class AvatarImage {

    /** Сторона хранимого портрета. */
    static final int SIDE = 256;

    /** Наибольшая сторона исходника. Проверяется по заголовку, до разбора. */
    static final int MAX_SOURCE_SIDE = 4096;

    /** Наименьшая сторона исходника. */
    static final int MIN_SOURCE_SIDE = 64;

    /** Наибольший размер присланного файла. */
    static final long MAX_UPLOAD_BYTES = 2L * 1024 * 1024;

    /** Что хранится и что отдаётся браузеру. */
    static final String CONTENT_TYPE = "image/jpeg";

    /**
     * Качество JPEG. 0.85 — то место, где на портрете в сто точек артефактов
     * не видно, а файл держится в десятках килобайт.
     */
    private static final float QUALITY = 0.85f;

    private static final int[] PNG_SIGNATURE = {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};

    private AvatarImage() {}

    record Normalized(byte[] bytes, int width, int height) {}

    static Normalized normalize(byte[] raw) {
        if (raw == null || raw.length == 0) {
            throw new StaffAvatars.Rejected("Файл пустой");
        }
        if (raw.length > MAX_UPLOAD_BYTES) {
            throw new StaffAvatars.TooLarge("Портрет больше разрешённых "
                    + (MAX_UPLOAD_BYTES / 1024 / 1024) + " МБ");
        }
        if (!looksLikeJpeg(raw) && !looksLikePng(raw)) {
            throw new StaffAvatars.Rejected(
                    "Это не JPEG и не PNG. Портал смотрит на содержимое файла, "
                            + "а не на его имя: расширение можно написать любое.");
        }

        var square = centerSquare(decode(raw));
        var canvas = new BufferedImage(SIDE, SIDE, BufferedImage.TYPE_INT_RGB);
        var g = canvas.createGraphics();
        try {
            // Белым, а не прозрачным: JPEG прозрачности не знает, и незалитый
            // фон у PNG с альфой стал бы чёрным квадратом.
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, SIDE, SIDE);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                    RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            // SCALE_SMOOTH, а не одно масштабирование трансформацией:
            // при уменьшении в десять раз билинейная выборка берёт каждую
            // десятую точку и превращает лицо в кашу.
            g.drawImage(square.getScaledInstance(SIDE, SIDE, Image.SCALE_SMOOTH), 0, 0, null);
        } finally {
            g.dispose();
        }

        return new Normalized(encode(canvas), SIDE, SIDE);
    }

    private static boolean looksLikeJpeg(byte[] raw) {
        return raw.length > 3
                && (raw[0] & 0xFF) == 0xFF && (raw[1] & 0xFF) == 0xD8 && (raw[2] & 0xFF) == 0xFF;
    }

    private static boolean looksLikePng(byte[] raw) {
        if (raw.length < PNG_SIGNATURE.length) return false;
        for (int i = 0; i < PNG_SIGNATURE.length; i++) {
            if ((raw[i] & 0xFF) != PNG_SIGNATURE[i]) return false;
        }
        return true;
    }

    private static BufferedImage decode(byte[] raw) {
        // Кеш в памяти, а не во временном файле: разбор одного портрета
        // не должен зависеть от того, есть ли на машине место под /tmp.
        try (var in = new MemoryCacheImageInputStream(new ByteArrayInputStream(raw))) {
            var readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw new StaffAvatars.Rejected("Файл не разбирается как изображение");
            }
            var reader = readers.next();
            try {
                reader.setInput(in, true, true);

                // Размеры берутся из заголовка — точки ещё не разобраны.
                // Ровно ради этого проверка стоит здесь, а не после read().
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width > MAX_SOURCE_SIDE || height > MAX_SOURCE_SIDE) {
                    throw new StaffAvatars.Rejected("Картинка больше "
                            + MAX_SOURCE_SIDE + "×" + MAX_SOURCE_SIDE + " точек (прислано "
                            + width + "×" + height + "). Обрежьте портрет.");
                }
                if (width < MIN_SOURCE_SIDE || height < MIN_SOURCE_SIDE) {
                    throw new StaffAvatars.Rejected("Картинка меньше "
                            + MIN_SOURCE_SIDE + "×" + MIN_SOURCE_SIDE + " точек (прислано "
                            + width + "×" + height + "). В кружке она будет мылом.");
                }

                var image = reader.read(0);
                if (image == null) {
                    throw new StaffAvatars.Rejected("Файл не разбирается как изображение");
                }
                return image;
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            // Подпись формата совпала, а внутри обрыв или мусор.
            throw new StaffAvatars.Rejected("Файл повреждён и не разбирается как изображение");
        }
    }

    /**
     * Квадрат из середины.
     *
     * Кружок в интерфейсе всё равно обрежет края, и растянуть прямоугольник
     * до квадрата значит сплющить лицо. Из середины — потому что портрет
     * снимают по центру кадра; предлагать рамку кадрирования ради того,
     * что видно в 36 точках, дороже пользы.
     */
    private static BufferedImage centerSquare(BufferedImage source) {
        int side = Math.min(source.getWidth(), source.getHeight());
        int x = (source.getWidth() - side) / 2;
        int y = (source.getHeight() - side) / 2;
        return source.getSubimage(x, y, side, side);
    }

    private static byte[] encode(BufferedImage image) {
        var writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new IllegalStateException("В этой сборке JVM нет кодировщика JPEG");
        }
        var writer = writers.next();
        var out = new ByteArrayOutputStream();
        try (var stream = new MemoryCacheImageOutputStream(out)) {
            var param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(QUALITY);
            writer.setOutput(stream);
            writer.write(null, new IIOImage(image, null, null), param);
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось закодировать портрет", e);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }
}
