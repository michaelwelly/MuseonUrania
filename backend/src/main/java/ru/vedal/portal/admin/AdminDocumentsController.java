package ru.vedal.portal.admin;

import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import ru.vedal.portal.audit.AuditLog;
import ru.vedal.portal.common.NotFoundException;
import ru.vedal.portal.documents.Document;
import ru.vedal.portal.documents.DocumentRepository;
import ru.vedal.portal.documents.FileStorage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Controller
@RequestMapping("/admin/documents")
public class AdminDocumentsController {

    private final DocumentRepository documents;
    private final FileStorage storage;
    private final AuditLog audit;

    public AdminDocumentsController(DocumentRepository documents, FileStorage storage, AuditLog audit) {
        this.documents = documents;
        this.storage = storage;
        this.audit = audit;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public String list(Model model) {
        model.addAttribute("documents", documents.findAllByOrderByDocGroupAscTitleAsc());
        return "admin/documents";
    }

    @PostMapping("/{id}/upload")
    @Transactional
    public String upload(@PathVariable UUID id, @RequestParam MultipartFile file,
                         Principal who, RedirectAttributes flash) {
        var document = find(id);
        if (file.isEmpty()) {
            flash.addFlashAttribute("error", "Файл не выбран");
            return "redirect:/admin/documents";
        }

        var key = document.getSlug() + extension(file.getOriginalFilename());
        try (var data = file.getInputStream()) {
            storage.put(FileStorage.Area.DOCUMENTS, key, data, file.getSize(), file.getContentType());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }

        document.setStorageKey(key);
        document.setFileSize(file.getSize());
        document.setUpdatedAt(Instant.now());
        documents.save(document);

        audit.record(actor(who), "document.upload", "document", document.getSlug(),
                Map.of("size", file.getSize()));
        flash.addFlashAttribute("message", "Файл загружен. Публикация — отдельным действием.");
        return "redirect:/admin/documents";
    }

    @PostMapping("/{id}/publish")
    @Transactional
    public String togglePublish(@PathVariable UUID id, Principal who, RedirectAttributes flash) {
        var document = find(id);

        if (document.isPublished()) {
            document.setPublished(false);
            document.setUpdatedAt(Instant.now());
            documents.save(document);
            audit.record(actor(who), "document.unpublish", "document", document.getSlug(), Map.of());
            flash.addFlashAttribute("message", "Документ снят с публикации.");
            return "redirect:/admin/documents";
        }

        // Проверки дублируют ограничения схемы намеренно: база не даст нарушить
        // правило, но редактор должен увидеть причину, а не страницу ошибки.
        var refusal = whyCannotPublish(document);
        if (refusal != null) {
            flash.addFlashAttribute("error", refusal);
            return "redirect:/admin/documents";
        }

        document.setPublished(true);
        document.setApprovedBy(actor(who));
        document.setUpdatedAt(Instant.now());
        documents.save(document);

        audit.record(actor(who), "document.publish", "document", document.getSlug(),
                Map.of("sensitivity", document.getSensitivity()));
        flash.addFlashAttribute("message", "Документ опубликован.");
        return "redirect:/admin/documents";
    }

    private static String whyCannotPublish(Document document) {
        if (!"public".equals(document.getSensitivity())) {
            return "Документ помечен как " + document.getSensitivity()
                    + ". Публично размещаются только public: сервисные инструкции, "
                    + "конструкторская и производственная документация на сайт не выкладываются.";
        }
        if (document.getStorageKey() == null) {
            return "Файл не загружен — публикация обещала бы скачивание, которого нет.";
        }
        if (!document.isListed()) {
            return "Документ не включён в публичный перечень.";
        }
        return null;
    }

    private static String extension(String filename) {
        if (filename == null) return "";
        var dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot).toLowerCase();
    }

    private Document find(UUID id) {
        return documents.findById(id).orElseThrow(() -> new NotFoundException("Документ не найден"));
    }

    private static String actor(Principal who) {
        return who == null ? "anonymous" : who.getName();
    }
}
