package ru.vedal.portal.crm;

import ru.vedal.portal.common.ConflictException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

// Воронки и их стадии.
//
// Три воронки из functional_requirements: продажи, дилерская и сервисная.
// У каждой свой набор стадий — «диагностика» в воронке продаж не значит
// ничего, а «КП отправлено» не значит ничего в сервисной.
//
// Правило живёт здесь, а не в контроллере: контроллер — это транспорт,
// и правило, записанное в нём, действует ровно до появления второго
// транспорта. То же самое продублировано ограничением deal_stage_check
// в схеме — здесь оно объясняется словами до нажатия, там его нельзя
// обойти вообще.
public final class Pipelines {

    public static final String SALES = "sales";
    public static final String DEALER = "dealer";
    public static final String SERVICE = "service";

    // LinkedHashMap, а не Map.of: порядок воронок и стадий попадает в форму
    // админки, а у Map.of он не определён — выбор стадии перемешивался бы
    // от запуска к запуску.
    private static final Map<String, List<String>> STAGES = new LinkedHashMap<>();

    static {
        STAGES.put(SALES, List.of("new", "qualified", "quoted", "won", "lost"));
        STAGES.put(DEALER, List.of("new", "talks", "agreement", "active", "declined"));
        STAGES.put(SERVICE, List.of("new", "diagnostics", "repair", "closed", "declined"));
    }

    // Чем заканчивается воронка. Названия у исходов разные, потому что
    // «выиграли» в дилерской воронке — это подключённый дилер, а в сервисной —
    // закрытое обращение; звать их одинаково значит соврать в карточке.
    // Для аналитики они всё равно сводятся к двум: получилось и не получилось.
    private static final Set<String> WON = Set.of("won", "active", "closed");
    private static final Set<String> LOST = Set.of("lost", "declined");

    private Pipelines() {}

    public static List<String> all() {
        return List.copyOf(STAGES.keySet());
    }

    public static List<String> stages(String pipeline) {
        var stages = STAGES.get(pipeline);
        if (stages == null) {
            throw new ConflictException("Неизвестная воронка: " + pipeline
                    + ". Допустимые: " + String.join(", ", STAGES.keySet()));
        }
        return stages;
    }

    /** Стадия, с которой сделка начинается в своей воронке. */
    public static String first(String pipeline) {
        return stages(pipeline).getFirst();
    }

    public static void check(String pipeline, String stage) {
        var stages = stages(pipeline);
        if (!stages.contains(stage)) {
            throw new ConflictException("Стадия «" + stage + "» не из воронки «" + pipeline
                    + "». Допустимые: " + String.join(", ", stages));
        }
    }

    public static boolean isWon(String stage) {
        return WON.contains(stage);
    }

    public static boolean isLost(String stage) {
        return LOST.contains(stage);
    }

    /** Стадия, дальше которой сделка не двигается. */
    public static boolean isClosed(String stage) {
        return isWon(stage) || isLost(stage);
    }

    static Set<String> wonStages() {
        return WON;
    }

    static Set<String> lostStages() {
        return LOST;
    }
}
