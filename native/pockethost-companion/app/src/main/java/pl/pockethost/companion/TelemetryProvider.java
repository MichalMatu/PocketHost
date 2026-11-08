package pl.pockethost.companion;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Binder;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.content.SharedPreferences;
import java.io.FileNotFoundException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Read-only, on-device IPC to Termux. No public HTTP listener and no
 * commands, privileged Binder handles or credentials cross this boundary.
 */
public final class TelemetryProvider extends ContentProvider {
    private static final long MAX_AGE_MS = 30000L;
    public static final String PREFS = "pockethost.telemetry";

    @Override public boolean onCreate() { return true; }

    private boolean permittedReader() {
        int uid = Binder.getCallingUid();
        if (uid == Process.myUid() || uid == Process.SHELL_UID) return true;
        PackageManager manager = getContext().getPackageManager();
        String[] packages = manager.getPackagesForUid(uid);
        if (packages != null) {
            for (String name : packages) {
                if ("com.termux".equals(name)) return true;
            }
        }
        return false;
    }

    private JSONObject status() throws Exception {
        SharedPreferences state = getContext().getSharedPreferences(PREFS, 0);
        long when = state.getLong("observedAtMs", 0);
        boolean fresh = when > 0 && when <= System.currentTimeMillis() &&
                System.currentTimeMillis() - when < MAX_AGE_MS;
        if (fresh) {
            String raw = state.getString("snapshot", "");
            if (raw != null && raw.length() < 8192) {
                JSONObject value = new JSONObject(raw);
                if ("android-companion".equals(value.optString("source")) &&
                        value.optInt("version") == 1) {
                    return value;
                }
            }
        }
        JSONObject disconnected = new JSONObject();
        disconnected.put("version", 1);
        disconnected.put("source", "android-companion");
        disconnected.put("connected", false);
        disconnected.put("authorized", false);
        disconnected.put("mode", "none");
        disconnected.put("observedAt", new java.util.Date().toInstant().toString());
        disconnected.put("cpuPercent", JSONObject.NULL);
        disconnected.put("visibleProcesses", JSONObject.NULL);
        disconnected.put("capabilities", new JSONArray());
        return disconnected;
    }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode)
            throws FileNotFoundException {
        if (!"/status".equals(uri.getPath()) || !"r".equals(mode)) {
            throw new FileNotFoundException("Only read-only telemetry /status exists");
        }
        if (!permittedReader()) throw new SecurityException("Only local Termux may read");
        try {
            final byte[] payload = status().toString().getBytes(StandardCharsets.UTF_8);
            final ParcelFileDescriptor[] pipe = ParcelFileDescriptor.createPipe();
            new Thread(() -> {
                try (OutputStream output =
                        new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) {
                    output.write(payload);
                } catch (Exception ignored) { }
            }, "pockethost-telemetry-read").start();
            return pipe[0];
        } catch (Exception e) {
            throw new FileNotFoundException("Telemetry snapshot unavailable");
        }
    }

    @Override public String getType(Uri uri) { return "application/json"; }
    @Override public Cursor query(Uri uri, String[] projection, String selection,
            String[] selectionArgs, String sortOrder) {
        throw new UnsupportedOperationException("Read via content read only");
    }
    @Override public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Read only");
    }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read only");
    }
    @Override public int update(Uri uri, ContentValues values,
            String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read only");
    }
}
