package ru.vedal.portal.chat;

import ru.vedal.portal.assistant.LlmEngine;
import java.util.List;

/** Navigation is offered only for site routes and public document sources. */
public record NavigationAction(String type, String title, String url, boolean confirmationRequired) {
    public static boolean safe(String url) {
        return url != null && (url.matches("/(?:about|products|production|service|documents|contacts|news)(?:/[a-z0-9-]+)*/?")
                || url.equals("/") || url.matches("/api/public/v1/documents/[a-z0-9-]+/file"));
    }
    public static List<NavigationAction> from(List<LlmEngine.Source> sources) {
        return sources.stream().filter(s -> safe(s.url()))
                .map(s -> new NavigationAction(s.url().startsWith("/api/") ? "document" : "navigate",
                        s.title(), s.url(), true)).distinct().toList();
    }
}
