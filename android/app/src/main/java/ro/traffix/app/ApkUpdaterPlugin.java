package ro.traffix.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * In-app updates for the sideloaded APK.
 *
 * fetchText: reads the release manifest natively (GitHub's download links send no CORS headers,
 * so the WebView can't fetch them). install: streams the APK straight into a PackageInstaller
 * session while hashing it, refuses it if the SHA-256 doesn't match, then hands the session to
 * Android, which shows its own "update this app?" confirmation. Android always closes the app to
 * replace it; nothing an app can do about that.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private static final String ACTION_STATUS = "ro.traffix.app.INSTALL_STATUS";
    private PluginCall pending;
    private BroadcastReceiver receiver;

    @PluginMethod
    public void fetchText(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("url missing"); return; }
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                conn = open(url);
                try (InputStream in = conn.getInputStream()) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                    JSObject ret = new JSObject();
                    ret.put("status", conn.getResponseCode());
                    ret.put("text", out.toString("UTF-8"));
                    call.resolve(ret);
                }
            } catch (Exception e) {
                call.reject(e.getMessage(), "NETWORK", e);
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    /** Whether Android lets Traffix install APKs (the "install unknown apps" switch, Android 8+). */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("allowed", Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256");
        if (url == null || sha256 == null) { call.reject("url and sha256 are required"); return; }
        if (pending != null) { call.reject("An update is already being installed", "BUSY"); return; }
        call.setKeepAlive(true);
        pending = call;
        new Thread(() -> download(url, sha256.trim().toLowerCase())).start();
    }

    private void download(String url, String expected) {
        PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();
        PackageInstaller.Session session = null;
        HttpURLConnection conn = null;
        try {
            PackageInstaller.SessionParams params =
                new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(getContext().getPackageName());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Once Traffix has installed itself, later updates can skip the confirmation.
                params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            }
            int id = installer.createSession(params);
            session = installer.openSession(id);

            conn = open(url);
            long total = conn.getContentLengthLong();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream in = conn.getInputStream();
                 OutputStream out = session.openWrite("traffix.apk", 0, total)) {
                byte[] buf = new byte[64 * 1024];
                long done = 0;
                int lastPercent = -1;
                for (int n; (n = in.read(buf)) > 0; ) {
                    out.write(buf, 0, n);
                    digest.update(buf, 0, n);
                    done += n;
                    int percent = total > 0 ? (int) (done * 100 / total) : -1;
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject p = new JSObject();
                        p.put("percent", percent);
                        notifyListeners("progress", p);
                    }
                }
                session.fsync(out);
            }

            if (!hex(digest.digest()).equals(expected)) {
                session.abandon();
                fail("The downloaded file doesn't match the release checksum", "CHECKSUM");
                return;
            }

            listenForStatus();
            Intent status = new Intent(ACTION_STATUS).setPackage(getContext().getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(getContext(), id, status, flags);
            JSObject p = new JSObject();
            p.put("percent", 100);
            p.put("stage", "installing");
            notifyListeners("progress", p);
            session.commit(pi.getIntentSender());
            session.close();
        } catch (Exception e) {
            if (session != null) session.abandon();
            fail(e.getMessage() != null ? e.getMessage() : "Download failed", "DOWNLOAD");
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void listenForStatus() {
        if (receiver != null) return;
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
                if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                    Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                    if (confirm != null) {
                        confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(confirm);
                    }
                } else if (status == PackageInstaller.STATUS_SUCCESS) {
                    // Normally Android has already closed the app by now.
                    if (pending != null) { pending.resolve(); pending = null; }
                } else if (status == PackageInstaller.STATUS_FAILURE_ABORTED) {
                    fail("Update cancelled", "CANCELLED");
                } else {
                    String msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
                    fail(msg != null ? msg : "Android refused the update", "INSTALL");
                }
            }
        };
        ContextCompat.registerReceiver(getContext(), receiver, new IntentFilter(ACTION_STATUS),
            ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private void fail(String message, String code) {
        PluginCall call = pending;
        pending = null;
        if (call != null) call.reject(message, code);
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true); // github.com -> release-assets.githubusercontent.com
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setRequestProperty("Accept", "application/octet-stream");
        int code = conn.getResponseCode();
        if (code != HttpURLConnection.HTTP_OK) throw new Exception("HTTP " + code);
        return conn;
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
            receiver = null;
        }
    }
}
