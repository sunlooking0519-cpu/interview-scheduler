package kr.wiseedu.cardocrtest;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class MobileApi {
    static final String SITE = "https://interview-scheduler26.vercel.app";
    private static final int MAX_IMAGE = 10 * 1024 * 1024;
    private final Context context;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private String accessToken = "";
    private String refreshToken = "";
    private String storageUrl = "";
    private String anonKey = "";
    private long expiresAt;

    interface Callback { void done(String error); }

    MobileApi(Context context) { this.context = context.getApplicationContext(); }

    boolean isLoggedIn() { return !refreshToken.isEmpty(); }

    void login(String email, String password, Callback callback) {
        worker.execute(() -> {
            String error = "";
            try {
                JSONObject request = new JSONObject().put("email", email).put("password", password);
                applySession(call("POST", SITE + "/api/mobile/session", request.toString().getBytes(StandardCharsets.UTF_8), "application/json", "", ""));
            } catch (Exception failure) { error = message(failure); }
            String result = error;
            main.post(() -> callback.done(result));
        });
    }

    void save(Uri image, String organization, String kind, String name, String title, String phone, String mobile, String email, String ocrText, Callback callback) {
        worker.execute(() -> {
            String error = "";
            String path = "";
            boolean saveRequestStarted = false;
            boolean confirmedFailure = false;
            try {
                ensureSession();
                byte[] bytes = readImage(image);
                String organizationId = UUID.randomUUID().toString();
                path = organizationId + "/" + UUID.randomUUID() + ".jpg";
                callWithRefresh("POST", storageUrl + "/" + path, bytes, "image/jpeg", true);
                JSONObject contact = new JSONObject().put("name", name).put("title", title).put("phone", phone)
                    .put("mobile", mobile).put("email", email).put("role", "");
                JSONObject body = new JSONObject().put("organizationId", organizationId).put("name", organization)
                    .put("kind", kind).put("contact", contact).put("imagePath", path).put("ocrText", ocrText);
                saveRequestStarted = true;
                JSONObject saved = callWithRefresh("POST", SITE + "/api/mobile/cards", body.toString().getBytes(StandardCharsets.UTF_8), "application/json", false);
                if (!saved.optString("error").isEmpty()) throw new IOException(saved.getString("error"));
                path = "";
            } catch (Exception failure) {
                error = message(failure);
                confirmedFailure = failure instanceof ApiException && ((ApiException) failure).status < 500;
            }
            // A connection loss after the save request leaves its result unknown; preserve the image.
            if (!path.isEmpty() && (!saveRequestStarted || confirmedFailure)) {
                try { callWithRefresh("DELETE", storageUrl + "/" + path, null, "application/json", true); }
                catch (Exception ignored) { /* The uploaded file can be removed from Storage by an administrator. */ }
            }
            String result = error;
            main.post(() -> callback.done(result));
        });
    }

    private byte[] readImage(Uri image) throws IOException {
        try (InputStream stream = context.getContentResolver().openInputStream(image);
             ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            if (stream == null) throw new IOException("사진을 읽지 못했습니다.");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = stream.read(buffer)) != -1) {
                if (bytes.size() + count > MAX_IMAGE) throw new IOException("사진이 10MB를 넘습니다. 다시 스캔해 주세요.");
                bytes.write(buffer, 0, count);
            }
            if (bytes.size() == 0) throw new IOException("사진을 읽지 못했습니다.");
            return bytes.toByteArray();
        }
    }

    private void ensureSession() throws Exception {
        if (refreshToken.isEmpty()) throw new IOException("먼저 관리자 계정으로 로그인해 주세요.");
        if (System.currentTimeMillis() / 1000L + 60 < expiresAt) return;
        refresh();
    }

    private void refresh() throws Exception {
        JSONObject request = new JSONObject().put("refreshToken", refreshToken);
        applySession(call("PUT", SITE + "/api/mobile/session", request.toString().getBytes(StandardCharsets.UTF_8), "application/json", "", ""));
    }

    private void applySession(JSONObject session) throws IOException {
        accessToken = session.optString("accessToken");
        refreshToken = session.optString("refreshToken");
        storageUrl = session.optString("storageUrl");
        anonKey = session.optString("anonKey");
        expiresAt = session.optLong("expiresAt");
        if (accessToken.isEmpty() || refreshToken.isEmpty() || !storageUrl.startsWith("https://") || anonKey.isEmpty()) {
            throw new IOException("로그인 응답이 올바르지 않습니다.");
        }
    }

    private JSONObject callWithRefresh(String method, String url, byte[] body, String type, boolean storage) throws Exception {
        try { return call(method, url, body, type, accessToken, storage ? anonKey : ""); }
        catch (ApiException failure) {
            if (failure.status != 401) throw failure;
            refresh();
            return call(method, url, body, type, accessToken, storage ? anonKey : "");
        }
    }

    private JSONObject call(String method, String url, byte[] body, String type, String token, String key) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        if (!token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
        if (!key.isEmpty()) connection.setRequestProperty("apikey", key);
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", type);
            connection.setFixedLengthStreamingMode(body.length);
            try (OutputStream output = connection.getOutputStream()) { output.write(body); }
        }
        try {
            int status = connection.getResponseCode();
            InputStream response = status < 400 ? connection.getInputStream() : connection.getErrorStream();
            String text;
            if (response == null) text = "";
            else try (InputStream stream = response; ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                byte[] chunk = new byte[4096];
                int read;
                while ((read = stream.read(chunk)) != -1 && buffer.size() < 30000) buffer.write(chunk, 0, read);
                text = buffer.toString(StandardCharsets.UTF_8.name());
            }
            JSONObject json = text.isEmpty() ? new JSONObject() : new JSONObject(text);
            if (status >= 400) throw new ApiException(status, json.optString("error", json.optString("message", "서버 오류 " + status)));
            return json;
        } finally { connection.disconnect(); }
    }

    private static String message(Exception error) {
        String value = error.getMessage();
        return value == null || value.isEmpty() ? "네트워크 연결을 확인한 뒤 다시 시도해 주세요." : value;
    }

    void close() { worker.shutdownNow(); }

    private static final class ApiException extends IOException {
        final int status;
        ApiException(int status, String message) { super(message); this.status = status; }
    }
}
