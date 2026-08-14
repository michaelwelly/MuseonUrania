package ru.vedal.portal.crm;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.common.ConflictException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Отчёты по воронке.
//
// Считается запросом в базу, а не обходом сущностей: отчёт за год — это
// агрегат по десяткам тысяч строк, и вытаскивать их в память ради
// group by значит однажды положить приложение отчётом.
@Service
public class CrmReports implements CrmAnalytics {

    // Имя колонки в запрос подставляется из этой таблицы, а не из параметра
    // запроса. Разрез приходит снаружи, и склеивать SQL с ним напрямую —
    // это внедрение SQL; здесь наружное значение работает ключом словаря,
    // и ничего, кроме четырёх известных колонок, в запрос попасть не может.
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();

    static {
        COLUMNS.put("product", "product_slug");
        COLUMNS.put("source", "source");
        COLUMNS.put("language", "language");
        COLUMNS.put("campaign", "campaign");
    }

    private final JdbcClient jdbc;

    public CrmReports(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public Report report(String by, LocalDate from, LocalDate to) {
        var column = COLUMNS.get(by);
        if (column == null) {
            throw new ConflictException("Неизвестный разрез: " + by
                    + ". Допустимые: " + String.join(", ", COLUMNS.keySet()));
        }

        // Левое соединение: заявка без сделки обязана попасть в отчёт.
        // Без неё разрез показывает конверсию только там, где она уже есть,
        // то есть единицу — и отчёт становится бессмысленным.
        //
        // deal_lead_idx делает связь «одна заявка — не больше одной сделки»,
        // поэтому суммы не задваиваются соединением.
        var sql = """
                select coalesce(nullif(l.%s, ''), '—')                         as bucket,
                       count(*)                                                as leads,
                       count(d.id)                                             as deals,
                       count(d.id) filter (where d.stage in (:won))            as won,
                       count(d.id) filter (where d.stage in (:lost))           as lost,
                       coalesce(sum(d.amount) filter (where d.stage in (:won)), 0) as won_amount
                from lead l
                left join deal d on d.lead_id = l.id
                where (cast(:from as date) is null or l.created_at >= cast(:from as date))
                  and (cast(:to   as date) is null or l.created_at < cast(:to as date) + 1)
                group by 1
                order by leads desc, bucket asc
                """.formatted(column);

        var rows = jdbc.sql(sql)
                .param("won", Pipelines.wonStages())
                .param("lost", Pipelines.lostStages())
                .param("from", from)
                .param("to", to)
                .query((rs, n) -> new Row(rs.getString("bucket"), rs.getLong("leads"),
                        rs.getLong("deals"), rs.getLong("won"), rs.getLong("lost"),
                        rs.getBigDecimal("won_amount")))
                .list();

        return new Report(by, from, to, rows, totals(rows));
    }

    private static Totals totals(List<Row> rows) {
        var amount = rows.stream().map(Row::wonAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Totals(
                rows.stream().mapToLong(Row::leads).sum(),
                rows.stream().mapToLong(Row::deals).sum(),
                rows.stream().mapToLong(Row::won).sum(),
                rows.stream().mapToLong(Row::lost).sum(),
                amount);
    }
}
