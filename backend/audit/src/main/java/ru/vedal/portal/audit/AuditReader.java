package ru.vedal.portal.audit;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.vedal.portal.common.PageView;

import java.util.List;

@Service
public class AuditReader implements AuditQuery {

    private static final int MAX_PAGE_SIZE = 200;

    private final AuditEntryRepository entries;

    public AuditReader(AuditEntryRepository entries) {
        this.entries = entries;
    }

    @Override
    @Transactional(readOnly = true)
    public PageView<Entry> entries(String subject, String subjectId, String actor,
                                   int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_PAGE_SIZE));
        return PageView.of(entries.search(blankToNull(subject), blankToNull(subjectId),
                blankToNull(actor), pageable), AuditReader::entry);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Entry> chain(String correlationId) {
        return entries.findByCorrelationIdOrderByAtAsc(correlationId).stream()
                .map(AuditReader::entry)
                .toList();
    }

    private static Entry entry(AuditEntry e) {
        return new Entry(e.getId(), e.getAt(), e.getActor(), e.getAction(), e.getSubject(),
                e.getSubjectId(), e.getCorrelationId(), e.getIp(), e.getPayload());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
