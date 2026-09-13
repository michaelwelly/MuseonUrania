package ru.vedal.portal.assistant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.io.ByteArrayOutputStream;
import static org.springframework.http.HttpStatus.*;

/** Ephemeral SpeechKit requests: no audio, transcript or provider error bodies in logs/storage. */
@Service
public class SpeechKit {
    private final String key;
    private final String stt;
    private final String tts;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper json = new ObjectMapper();
    @org.springframework.beans.factory.annotation.Autowired
    public SpeechKit(@Value("${vedal.speechkit.api-key:${VEDAL_SPEECHKIT_API_KEY:}}") String key) {
        this(key, "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize",
                "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize");
    }
    SpeechKit(String key, String stt, String tts) {
        this.key = key;
        this.stt = stt;
        this.tts = tts;
    }
    public boolean available() { return !key.isBlank(); }

    public String recognize(byte[] pcm) {
        var result = exchange(stt + "?lang=ru-RU&format=lpcm&sampleRateHertz=16000",
                "application/octet-stream", pcm);
        try {
            return json.readTree(result).path("result").asString("");
        } catch (RuntimeException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "Не удалось разобрать ответ распознавания");
        }
    }

    public byte[] synthesize(String text) {
        var pcm = new ByteArrayOutputStream();
        // v1 limits UTF-8 bytes per request. Split on code points, retaining every character.
        var part = new StringBuilder();
        int bytes = 0;
        for (int cp : text.codePoints().toArray()) {
            var s = new String(Character.toChars(cp));
            int size = s.getBytes(StandardCharsets.UTF_8).length;
            if (bytes + size > 3500) {
                pcm.writeBytes(synthesizePart(part.toString()));
                part.setLength(0);
                bytes = 0;
            }
            part.append(s);
            bytes += size;
        }
        if (!part.isEmpty()) pcm.writeBytes(synthesizePart(part.toString()));
        return wav(pcm.toByteArray());
    }

    private byte[] synthesizePart(String text) {
        var form = "lang=ru-RU&voice=alena&format=lpcm&sampleRateHertz=16000&text="
                + URLEncoder.encode(text, StandardCharsets.UTF_8);
        return exchange(tts,
                "application/x-www-form-urlencoded", form.getBytes(StandardCharsets.UTF_8));
    }

    private byte[] exchange(String uri, String type, byte[] body) {
        if (!available()) throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Голос временно недоступен");
        try {
            var request = HttpRequest.newBuilder(URI.create(uri)).timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Api-Key " + key)
                    .header("Content-Type", type).POST(HttpRequest.BodyPublishers.ofByteArray(body)).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() != 200) throw new ResponseStatusException(BAD_GATEWAY, "Голос временно недоступен");
            return response.body();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(SERVICE_UNAVAILABLE, "Голос временно недоступен");
        } catch (java.io.IOException e) {
            throw new ResponseStatusException(BAD_GATEWAY, "Голос временно недоступен");
        }
    }

    static byte[] wav(byte[] pcm) {
        return ByteBuffer.allocate(44 + pcm.length).order(ByteOrder.LITTLE_ENDIAN)
                .put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + pcm.length)
                .put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16)
                .putShort((short) 1).putShort((short) 1).putInt(16000).putInt(32000)
                .putShort((short) 2).putShort((short) 16)
                .put("data".getBytes(StandardCharsets.US_ASCII)).putInt(pcm.length).put(pcm).array();
    }
}
