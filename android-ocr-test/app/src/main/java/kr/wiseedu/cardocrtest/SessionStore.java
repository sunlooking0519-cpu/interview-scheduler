package kr.wiseedu.cardocrtest;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class SessionStore {
    private static final String KEY_ALIAS = "wise_card_ocr_session_v1";
    private static final String PREFS = "private_session";
    private static final String ENTRY = "encrypted_session";
    private final SharedPreferences preferences;

    static final class Saved {
        final String refreshToken;
        final String email;

        Saved(String refreshToken, String email) {
            this.refreshToken = refreshToken;
            this.email = email;
        }
    }

    SessionStore(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    void save(String refreshToken, String email) throws Exception {
        JSONObject data = new JSONObject().put("refreshToken", refreshToken).put("email", email);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(data.toString().getBytes(StandardCharsets.UTF_8));
        String encoded = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "."
            + Base64.encodeToString(encrypted, Base64.NO_WRAP);
        if (!preferences.edit().putString(ENTRY, encoded).commit()) throw new IllegalStateException("로그인 정보를 저장하지 못했습니다.");
    }

    Saved load() {
        String encoded = preferences.getString(ENTRY, "");
        if (encoded == null || encoded.isEmpty()) return null;
        try {
            String[] parts = encoded.split("\\.", 2);
            if (parts.length != 2) throw new IllegalArgumentException("Invalid session");
            byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            JSONObject data = new JSONObject(new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8));
            String refreshToken = data.optString("refreshToken");
            if (refreshToken.isEmpty()) throw new IllegalArgumentException("Missing refresh token");
            return new Saved(refreshToken, data.optString("email"));
        } catch (Exception invalid) {
            clear();
            return null;
        }
    }

    void clear() { preferences.edit().remove(ENTRY).commit(); }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        SecretKey existing = (SecretKey) store.getKey(KEY_ALIAS, null);
        if (existing != null) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(128)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
        return generator.generateKey();
    }
}
