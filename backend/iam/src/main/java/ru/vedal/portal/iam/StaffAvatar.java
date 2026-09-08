package ru.vedal.portal.iam;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Портрет сотрудника.
 *
 * Ключ — логин: портрет у человека один, и заменяется он целиком.
 * Почему байты лежат в базе, а не в объектном хранилище, разобрано
 * в миграции V35 — коротко: оба бакета не подходят (media открыт наружу
 * и недоступен ключу, documents — сейф документов со своими правилами),
 * а размер здесь ограничен и мал.
 */
@Entity
@Table(name = "staff_avatar")
public class StaffAvatar {

    @Id
    private String login;

    /**
     * {@code sub} из токена Keycloak. В запасном режиме {@code local}
     * его не бывает, и тогда здесь пусто.
     */
    private String subject;

    @Column(name = "content_type")
    private String contentType;

    private byte[] bytes;

    private int width;
    private int height;

    private String etag;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public String getLogin() { return login; }
    public void setLogin(String login) { this.login = login; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public byte[] getBytes() { return bytes; }
    public void setBytes(byte[] bytes) { this.bytes = bytes; }
    public int getWidth() { return width; }
    public void setWidth(int width) { this.width = width; }
    public int getHeight() { return height; }
    public void setHeight(int height) { this.height = height; }
    public String getEtag() { return etag; }
    public void setEtag(String etag) { this.etag = etag; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
