package ru.vedal.portal.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Integer.MIN_VALUE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        CorrelationId.set(request.getHeader(CorrelationId.HEADER));
        response.setHeader(CorrelationId.HEADER, CorrelationId.current());
        try {
            chain.doFilter(request, response);
        } finally {
            // Пул потоков переиспользует поток: без очистки следующий запрос
            // унаследует чужой идентификатор и склеит два инцидента в один.
            CorrelationId.clear();
        }
    }
}
