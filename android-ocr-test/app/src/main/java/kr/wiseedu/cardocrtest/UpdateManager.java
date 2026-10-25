package kr.wiseedu.cardocrtest;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class UpdateManager {
    private static final String RELEASES_URL =
        "https://api.github.com/repos/sunlooking0519-cpu/interview-scheduler/releases?per_page=10";
    private static final String APK_ASSET = "wise-card-ocr-test.apk";
    private static final Pattern VERSION_TAG = Pattern.compile("android-ocr-v(\\d+(?:\\.\\d+){1,3})");
    private static final long MAX_APK_BYTES = 120L * 1024 * 1024;

    private final Activity activity;
    private final TextView status;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean checking = new AtomicBoolean();
    private File pendingApk;
    private boolean openedInstallSettings;

    UpdateManager(Activity activity, TextView status) {
        this.activity = activity;
        this.status = status;
    }

    void check() {
        if (!checking.compareAndSet(false, true)) return;
        openedInstallSettings = false;
        status.setText(R.string.update_checking);
        worker.execute(() -> {
            try {
                PackageInfo installed = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
                String currentVersion = installed.versionName == null ? "0.0.0" : installed.versionName;
                Release release = latestRelease(currentVersion);
                if (release == null) {
                    postStatus(R.string.update_current, currentVersion);
                    return;
                }
                postStatus(R.string.update_downloading, release.version);
                File apk = download(release);
                PackageInfo candidate = activity.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
                long installedCode = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
                long candidateCode = candidate == null ? -1 :
                    (Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode);
                if (candidate == null || !activity.getPackageName().equals(candidate.packageName)
                    || candidateCode <= installedCode) {
                    throw new IllegalStateException("업데이트 APK의 패키지 또는 버전이 올바르지 않습니다.");
                }
                activity.runOnUiThread(() -> {
                    if (activity.isFinishing() || activity.isDestroyed()) return;
                    pendingApk = apk;
                    continueInstallation();
                });
            } catch (Exception error) {
                postStatus(R.string.update_failed);
            } finally {
                checking.set(false);
            }
        });
    }

    void continueInstallation() {
        if (pendingApk == null) return;
        if (Build.VERSION.SDK_INT >= 26 && !activity.getPackageManager().canRequestPackageInstalls()) {
            if (openedInstallSettings) {
                status.setText(R.string.update_permission_denied);
                return;
            }
            openedInstallSettings = true;
            status.setText(R.string.update_permission);
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + activity.getPackageName()));
            try {
                activity.startActivity(settings);
            } catch (RuntimeException error) {
                status.setText(R.string.update_permission_denied);
            }
            return;
        }

        File apk = pendingApk;
        pendingApk = null;
        openedInstallSettings = false;
        Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".updates", apk);
        Intent installer = new Intent(Intent.ACTION_VIEW);
        installer.setDataAndType(uri, "application/vnd.android.package-archive");
        installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            activity.startActivity(installer);
            status.setText(R.string.update_installing);
        } catch (RuntimeException error) {
            pendingApk = apk;
            status.setText(R.string.update_failed);
        }
    }

    void close() {
        worker.shutdownNow();
    }

    private Release latestRelease(String currentVersion) throws Exception {
        HttpURLConnection connection = open(RELEASES_URL);
        try (InputStream stream = connection.getInputStream()) {
            JSONArray releases = new JSONArray(new String(readLimited(stream, 1024 * 1024), StandardCharsets.UTF_8));
            Release newest = null;
            for (int i = 0; i < releases.length(); i++) {
                JSONObject item = releases.getJSONObject(i);
                if (item.optBoolean("draft") || item.optBoolean("prerelease")) continue;
                Matcher tag = VERSION_TAG.matcher(item.optString("tag_name"));
                if (!tag.matches()) continue;
                String version = tag.group(1);
                if (compareVersions(version, currentVersion) <= 0) continue;
                JSONArray assets = item.optJSONArray("assets");
                if (assets == null) continue;
                for (int j = 0; j < assets.length(); j++) {
                    JSONObject asset = assets.getJSONObject(j);
                    if (!APK_ASSET.equals(asset.optString("name"))) continue;
                    String digest = asset.optString("digest");
                    if (!digest.matches("sha256:[a-fA-F0-9]{64}")) continue;
                    String url = asset.optString("browser_download_url");
                    if (!isAllowedDownloadUrl(url)) continue;
                    if (newest == null || compareVersions(version, newest.version) > 0) {
                        newest = new Release(version, url, digest.substring(7).toLowerCase(Locale.ROOT));
                    }
                }
            }
            return newest;
        } finally {
            connection.disconnect();
        }
    }

    private File download(Release release) throws Exception {
        File directory = new File(activity.getCacheDir(), "updates");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("업데이트 저장 실패");
        File apk = new File(directory, "wise-card-ocr-test.apk");
        if (apk.isFile() && release.digest.equals(sha256(apk))) return apk;
        File temporary = new File(directory, "download.tmp");
        HttpURLConnection connection = open(release.url);
        try {
            long expectedSize = connection.getContentLength();
            if (expectedSize > MAX_APK_BYTES) throw new IllegalStateException("APK 크기 초과");
            long bytes = 0;
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(temporary)) {
                byte[] buffer = new byte[32768];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    bytes += count;
                    if (bytes > MAX_APK_BYTES) throw new IllegalStateException("APK 크기 초과");
                    output.write(buffer, 0, count);
                }
            }
            if (bytes == 0 || !release.digest.equals(sha256(temporary))) {
                throw new IllegalStateException("APK 무결성 검증 실패");
            }
            if (apk.exists() && !apk.delete()) throw new IllegalStateException("기존 APK 교체 실패");
            if (!temporary.renameTo(apk)) throw new IllegalStateException("APK 저장 실패");
            return apk;
        } finally {
            connection.disconnect();
            if (temporary.exists()) temporary.delete();
        }
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("User-Agent", "WiseCardOcrTest-Android");
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        if (connection.getResponseCode() != 200) {
            int code = connection.getResponseCode();
            connection.disconnect();
            throw new IllegalStateException("HTTP " + code);
        }
        return connection;
    }

    private static byte[] readLimited(InputStream stream, int maximum) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = stream.read(buffer)) != -1) {
            if (output.size() + count > maximum) throw new IllegalStateException("응답 크기 초과");
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768];
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        StringBuilder hex = new StringBuilder(64);
        for (byte value : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        return hex.toString();
    }

    private static boolean isAllowedDownloadUrl(String value) {
        try {
            URL url = new URL(value);
            return "https".equals(url.getProtocol()) && "github.com".equals(url.getHost())
                && url.getPath().startsWith("/sunlooking0519-cpu/interview-scheduler/releases/download/");
        } catch (Exception error) {
            return false;
        }
    }

    private static int compareVersions(String first, String second) {
        String[] a = first.split("\\.");
        String[] b = second.split("\\.");
        for (int i = 0; i < Math.max(a.length, b.length); i++) {
            int left = i < a.length ? Integer.parseInt(a[i]) : 0;
            int right = i < b.length ? Integer.parseInt(b[i]) : 0;
            if (left != right) return Integer.compare(left, right);
        }
        return 0;
    }

    private void postStatus(int resource, Object... arguments) {
        activity.runOnUiThread(() -> {
            if (activity.isFinishing() || activity.isDestroyed()) return;
            status.setText(activity.getString(resource, arguments));
        });
    }

    private static final class Release {
        final String version;
        final String url;
        final String digest;

        Release(String version, String url, String digest) {
            this.version = version;
            this.url = url;
            this.digest = digest;
        }
    }
}
