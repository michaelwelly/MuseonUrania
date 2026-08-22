package ru.vedal.portal.app;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;
import ru.vedal.portal.PostgresTestBase;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Файлы docs/api/*.{json,yaml} — выгрузка, снятая руками с поднятого приложения;
// источник истины — аннотации контроллеров и записей DTO. Между «контракт
// поменялся» и «выгрузку обновили» до сих пор не стояло ничего, кроме памяти
// разработчика: OpenApiDocsTest сверяет состав дверей с настоящими маршрутами,
// но не с этими файлами. Интегратор же читает файл, а не то, что отвечает
// приложение, — и молча отставшая выгрузка для него и есть контракт.
//
// Сторож сверяет разобранные документы, а не строки: перенос, порядок ключей
// и отступы к контракту отношения не имеют и ронять сборку не должны.
@AutoConfigureMockMvc
class OpenApiDumpTest extends PostgresTestBase {

    // Сколько расхождений показывать. Первая же правка контракта, забытая
    // в выгрузке, даёт их сотнями — простыня на весь экран не помогает.
    private static final int SHOWN = 30;

    private static final Path DUMPS = dumpsDirectory();

    @Autowired
    MockMvc mvc;

    // Тот же управляемый Spring ObjectMapper, что и в OpenApiDocsTest: в Boot 4
    // это Jackson 3 (tools.jackson), а Jackson 2 на classpath приезжает
    // со swagger-core для его собственной сериализации.
    @Autowired
    ObjectMapper json;

    @Test
    void publicDumpMatchesTheCode() throws Exception {
        assertDumpMatchesCode("vedal-public", "vedal-openapi");
    }

    @Test
    void adminDumpMatchesTheCode() throws Exception {
        assertDumpMatchesCode("vedal-admin", "vedal-admin-openapi");
    }

    // Обе выгрузки одной группы сверяются с ответом приложения по отдельности:
    // JSON и YAML снимаются двумя разными запросами и отстать могут порознь —
    // достаточно обновить один файл и забыть второй.
    private void assertDumpMatchesCode(String group, String name) throws Exception {
        assertMatchesCode(name + ".json",
                parseJson(read(name + ".json")),
                parseJson(fetch("/v3/api-docs/" + group)));

        // Адрес YAML — отдельным сегментом перед группой (/v3/api-docs.yaml/{group}),
        // а не расширением после неё. По /v3/api-docs/{group}.yaml приложение
        // отдаёт не YAML, и выгрузка снимется пустой.
        assertMatchesCode(name + ".yaml",
                parseYaml(read(name + ".yaml")),
                parseYaml(fetch("/v3/api-docs.yaml/" + group)));
    }

    private void assertMatchesCode(String name, Map<String, Object> fromFile, Map<String, Object> fromCode) {
        var found = differences(fromFile, fromCode);
        if (found.isEmpty()) {
            return;
        }

        var report = new StringBuilder("Спецификация docs/api/").append(name)
                .append(" разошлась с кодом, перегенерируйте выгрузку: править её")
                .append(" в docs/api бессмысленно, контракт собирается из аннотаций.")
                .append("\nКак снять заново — docs/api/README.md, «Как обновить выгрузку»;")
                .append(" следом пересобирается и коллекция Postman, она читает эти же файлы.")
                .append("\nРасхождений — ").append(found.size()).append(", по путям в документе:");

        found.stream().limit(SHOWN).forEach(line -> report.append("\n  ").append(line));
        if (found.size() > SHOWN) {
            report.append("\n  … ещё ").append(found.size() - SHOWN).append(" — показаны первые ").append(SHOWN);
        }

        throw new AssertionError(report.toString());
    }

    // Расхождения перечисляются путём в документе (paths./api/…/products.get.summary),
    // а не диффом двух простыней: по такому пути видно, какая дверь разъехалась.
    private static List<String> differences(Map<String, Object> fromFile, Map<String, Object> fromCode) {
        var found = new ArrayList<String>();
        compare("", withoutServerPort(fromFile), withoutServerPort(fromCode), found);

        // Двери вперёд, схемы за ними: обрезка по SHOWN не должна съедать
        // самое интересное ради алфавита, в котором components идёт первым.
        found.sort((left, right) -> Integer.compare(weight(left), weight(right)));
        return found;
    }

    private static int weight(String line) {
        if (line.startsWith("paths.")) {
            return 0;
        }
        return line.startsWith("components.") ? 2 : 1;
    }

    private static void compare(String at, Object fromFile, Object fromCode, List<String> found) {
        if (fromFile instanceof Map<?, ?> file && fromCode instanceof Map<?, ?> code) {
            var keys = new TreeSet<String>();
            file.keySet().forEach(key -> keys.add(String.valueOf(key)));
            code.keySet().forEach(key -> keys.add(String.valueOf(key)));

            for (var key : keys) {
                var inner = at.isEmpty() ? key : at + "." + key;
                if (!code.containsKey(key)) {
                    found.add(inner + ": есть в выгрузке, в коде нет");
                } else if (!file.containsKey(key)) {
                    found.add(inner + ": появилось в коде, в выгрузке нет");
                } else {
                    compare(inner, file.get(key), code.get(key), found);
                }
            }
            return;
        }

        if (fromFile instanceof List<?> file && fromCode instanceof List<?> code) {
            for (int i = 0; i < Math.min(file.size(), code.size()); i++) {
                compare(at + "[" + i + "]", file.get(i), code.get(i), found);
            }
            for (int i = code.size(); i < file.size(); i++) {
                found.add(at + "[" + i + "]: есть в выгрузке, в коде нет — " + shorten(file.get(i)));
            }
            for (int i = file.size(); i < code.size(); i++) {
                found.add(at + "[" + i + "]: появилось в коде, в выгрузке нет — " + shorten(code.get(i)));
            }
            return;
        }

        if (!same(fromFile, fromCode)) {
            found.add(at + ": в выгрузке «" + shorten(fromFile) + "», в коде «" + shorten(fromCode) + "»");
        }
    }

    // 10 и 10.0 — одно и то же ограничение: разница целого и дробного приезжает
    // из разбора, а не из контракта.
    private static boolean same(Object fromFile, Object fromCode) {
        if (fromFile instanceof Number file && fromCode instanceof Number code) {
            return new BigDecimal(file.toString()).compareTo(new BigDecimal(code.toString())) == 0;
        }
        return Objects.equals(fromFile, fromCode);
    }

    private static String shorten(Object value) {
        var text = String.valueOf(value).replace("\n", "\\n");
        return text.length() <= 80 ? text : text.substring(0, 80) + "…";
    }

    // Выгрузка снимается с приложения, поднятого на порту (http://localhost:8081),
    // а MockMvc порта не знает и отдаёт http://localhost. Различие в адресе
    // сервера — свойство способа снятия, а не контракта; без нормализации сторож
    // падал бы всегда и его выключили бы на второй день.
    @SuppressWarnings("unchecked")
    private static Map<String, Object> withoutServerPort(Map<String, Object> spec) {
        if (spec.get("servers") instanceof List<?> servers) {
            for (var server : servers) {
                if (server instanceof Map<?, ?> entry && entry.get("url") instanceof String url) {
                    ((Map<String, Object>) entry).put("url", withoutPort(url));
                }
            }
        }
        return spec;
    }

    private static String withoutPort(String url) {
        try {
            var address = new URI(url);
            if (address.getHost() == null || address.getPort() < 0) {
                return url;
            }
            return new URI(address.getScheme(), null, address.getHost(), -1,
                    address.getPath(), address.getQuery(), address.getFragment()).toString();
        } catch (URISyntaxException e) {
            return url;
        }
    }

    private String fetch(String path) throws Exception {
        // Без явной кодировки MockMvc отдаёт тело в ISO-8859-1, и кириллица
        // в описаниях превращается в мусор: сторож нашёл бы расхождение
        // в каждой строке с русским текстом.
        return mvc.perform(get(path))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private static String read(String name) throws Exception {
        var file = DUMPS.resolve(name);
        if (!Files.isRegularFile(file)) {
            throw new AssertionError("Выгрузки " + file + " нет. Она часть контракта,"
                    + " а не временный файл: снимите её по docs/api/README.md, «Как обновить выгрузку».");
        }
        return Files.readString(file, StandardCharsets.UTF_8);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String document) {
        return json.readValue(document, Map.class);
    }

    // Один и тот же разборщик для файла и для ответа приложения — иначе
    // расхождение приедет из разницы разборщиков, а не из контракта.
    @SuppressWarnings("unchecked")
    private static Map<String, Object> parseYaml(String document) {
        return new Yaml(new SafeConstructor(new LoaderOptions())).load(document);
    }

    // Тесты запускаются из backend/app, до docs/api оттуда два уровня вверх.
    // Каталог всё же ищется подъёмом, а не складывается из «../..»: из IDE
    // рабочим каталогом бывает и корень репозитория, и модуль backend.
    private static Path dumpsDirectory() {
        var from = Path.of("").toAbsolutePath();
        for (var at = from; at != null; at = at.getParent()) {
            var dumps = at.resolve("docs").resolve("api");
            if (Files.isDirectory(dumps)) {
                return dumps;
            }
        }
        throw new IllegalStateException("Не нашёл каталог docs/api, поднимаясь от " + from);
    }
}
