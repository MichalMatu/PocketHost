package pl.pockethost.companion;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import android.database.Cursor;
import android.net.Uri;
import android.os.Binder;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.net.TrafficStats;
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

    /** Android totals count all interfaces since boot; unsupported is not zero. */
    private static JSONObject attachNetwork(JSONObject status) throws Exception {
        JSONObject network = new JSONObject();
        network.put("source", "android-trafficstats");
        network.put("scope", "all-interfaces-since-boot");
        network.put("observedAt", java.time.Instant.now().toString());
        long rx = TrafficStats.UNSUPPORTED;
        long tx = TrafficStats.UNSUPPORTED;
        try {
            rx = TrafficStats.getTotalRxBytes();
            tx = TrafficStats.getTotalTxBytes();
        } catch (SecurityException ignored) {
            // Permission limits are represented by null, not a false zero.
        }
        network.put("rxBytes", rx >= 0 ? rx : JSONObject.NULL);
        network.put("txBytes", tx >= 0 ? tx : JSONObject.NULL);
        status.put("network", network);
        return status;
    }

    static JSONObject status(android.content.Context context) throws Exception {
        SharedPreferences state = context.getSharedPreferences(PREFS, 0);
        long when = state.getLong("observedAtMs", 0);
        boolean fresh = when > 0 && when <= System.currentTimeMillis() &&
                System.currentTimeMillis() - when < MAX_AGE_MS;
        if (fresh) {
            String raw = state.getString("snapshot", "");
            if (raw != null && raw.length() < 8192) {
                JSONObject value = new JSONObject(raw);
                if ("android-companion".equals(value.optString("source")) &&
                        value.optInt("version") == 1) {
                    return attachNetwork(value);
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
        return attachNetwork(disconnected);
    }

    /** Only recently authorized native readings may be served to the local dashboard. */
    static JSONObject apps(android.content.Context context) throws Exception {
        JSONObject live = status(context);
        if (!live.optBoolean("connected") || !live.optBoolean("authorized")) {
            throw new SecurityException("Companion not authorized");
        }
        SharedPreferences state = context.getSharedPreferences(PREFS, 0);
        long when = state.getLong("appsAtMs", 0);
        long now = System.currentTimeMillis();
        if (when <= 0 || when > now || now - when > 300000L) {
            throw new IllegalStateException("Android app inventory expired");
        }
        String raw = state.getString("appsSnapshot", "");
        if (raw == null || raw.length() > 280000) {
            throw new IllegalStateException("Android app inventory missing");
        }
        JSONObject source = new JSONObject(raw);
        int uid = source.getInt("uid");
        if (source.getInt("version") != 1 ||
                !"shizuku-user-service".equals(source.getString("source")) ||
                (uid != 0 && uid != 2000)) {
            throw new SecurityException("Unexpected inventory privilege");
        }
        JSONObject result = new JSONObject();
        result.put("version", 1);
        result.put("source", "android-companion");
        result.put("connected", true);
        result.put("authorized", true);
        result.put("mode", uid == 0 ? "root" : "adb");
        result.put("observedAt", source.getString("observedAt"));
        JSONArray original = source.getJSONArray("packages");
        JSONArray decorated = new JSONArray();
        PackageManager manager = context.getPackageManager();
        for (int i = 0; i < original.length(); i++) {
            JSONObject entry = original.getJSONObject(i);
            String pkg = entry.getString("packageName");
            JSONObject item = new JSONObject();
            item.put("packageName", pkg);
            item.put("system", entry.getBoolean("system"));
            try {
                ApplicationInfo application = manager.getApplicationInfo(pkg, 0);
                item.put("label", trimLabel(manager.getApplicationLabel(application).toString()));
                item.put("enabled", application.enabled);
            } catch (PackageManager.NameNotFoundException unavailable) {
                // Shizuku may observe packages absent for this Android user.
                item.put("label", "");
                item.put("enabled", JSONObject.NULL);
            }
            decorated.put(item);
        }
        result.put("packages", decorated);
        result.put("truncated", source.getBoolean("truncated"));
        return result;
    }


    private static String trimLabel(String raw) {
        if (raw == null) return "";
        return raw.length() > 120 ? raw.substring(0, 120) : raw;
    }

    /**
     * Privilege-checked read-only metadata, sourced from Android PackageManager.
     * The package must also be present in the authorized native Shizuku inventory.
     */
    static JSONObject app(android.content.Context context, String packageName) throws Exception {
        if (packageName == null || packageName.length() > 200 ||
                !packageName.matches("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+")) {
            throw new IllegalArgumentException("Invalid package identifier");
        }
        JSONObject inventory = apps(context);
        JSONArray installed = inventory.getJSONArray("packages");
        JSONObject selected = null;
        for (int i = 0; i < installed.length(); i++) {
            JSONObject item = installed.getJSONObject(i);
            if (packageName.equals(item.getString("packageName"))) {
                selected = item;
                break;
            }
        }
        if (selected == null) throw new SecurityException("Package not in Shizuku inventory");
        PackageManager pm = context.getPackageManager();
        PackageInfo info = pm.getPackageInfo(packageName, PackageManager.GET_PERMISSIONS);
        ApplicationInfo application = pm.getApplicationInfo(packageName, 0);
        JSONObject result = new JSONObject();
        result.put("version", 1);
        result.put("source", "android-companion");
        result.put("packageName", packageName);
        result.put("label", trimLabel(pm.getApplicationLabel(application).toString()));
        result.put("versionName", info.versionName == null ? "" : trimLabel(info.versionName));
        result.put("versionCode", info.getLongVersionCode());
        result.put("targetSdk", application.targetSdkVersion);
        result.put("enabled", application.enabled);
        result.put("system", selected.getBoolean("system"));
        JSONArray permissions = new JSONArray();
        if (info.requestedPermissions != null) {
            for (int i = 0; i < info.requestedPermissions.length && permissions.length() < 96; i++) {
                String name = info.requestedPermissions[i];
                if (name == null || name.length() > 200) continue;
                JSONObject entry = new JSONObject();
                entry.put("name", name);
                boolean granted = info.requestedPermissionsFlags != null &&
                        i < info.requestedPermissionsFlags.length &&
                        (info.requestedPermissionsFlags[i] & PackageInfo.REQUESTED_PERMISSION_GRANTED) != 0;
                entry.put("granted", granted);
                permissions.put(entry);
            }
        }
        result.put("permissions", permissions);
        try {
            Drawable drawable = pm.getApplicationIcon(packageName);
            Bitmap bitmap = Bitmap.createBitmap(56, 56, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            drawable.setBounds(0, 0, 56, 56);
            drawable.draw(canvas);
            ByteArrayOutputStream stream = new ByteArrayOutputStream();
            if (bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)) {
                String encoded = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP);
                if (encoded.length() <= 65000) result.put("iconPng", encoded);
            }
            bitmap.recycle();
        } catch (Exception ignored) {
            // Optional icon, no fabricated image if the package is invisible.
        }
        return result;
    }

    static JSONObject system(android.content.Context context) throws Exception {
        JSONObject live = status(context);
        if (!live.optBoolean("connected") || !live.optBoolean("authorized")) {
            throw new SecurityException("Shizuku authorization missing");
        }
        SharedPreferences preferences = context.getSharedPreferences(PREFS, 0);
        long when = preferences.getLong("systemAtMs", 0);
        long now = System.currentTimeMillis();
        if (when <= 0 || when > now || now - when > 120000L)
            throw new IllegalStateException("System readings expired");
        String raw = preferences.getString("systemSnapshot", "");
        if (raw == null || raw.length() > 380000) throw new IllegalStateException("System data unavailable");
        JSONObject snapshot = new JSONObject(raw);
        int uid = snapshot.getInt("uid");
        if (!"shizuku-user-service".equals(snapshot.getString("source")) ||
                snapshot.getInt("version") != 1 || (uid != 0 && uid != 2000) ||
                !snapshot.getString("observedAt").startsWith("20")) {
            throw new SecurityException("Invalid Shizuku system data");
        }
        JSONObject result = new JSONObject();
        result.put("version", 1);
        result.put("source", "android-companion");
        result.put("connected", true);
        result.put("authorized", true);
        result.put("mode", uid == 0 ? "root" : "adb");
        result.put("observedAt", snapshot.getString("observedAt"));
        result.put("processes", snapshot.getJSONArray("processes"));
        result.put("processesTruncated", snapshot.getBoolean("processesTruncated"));
        if (snapshot.has("processError")) result.put("processError", snapshot.getString("processError"));
        result.put("power", snapshot.getJSONObject("power"));
        result.put("settings", snapshot.getJSONObject("settings"));
        result.put("services", snapshot.getJSONObject("services"));
        return result;
    }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode)
            throws FileNotFoundException {
        if (!"/status".equals(uri.getPath()) || !"r".equals(mode)) {
            throw new FileNotFoundException("Only read-only telemetry /status exists");
        }
        if (!permittedReader()) throw new SecurityException("Only local Termux may read");
        try {
            final byte[] payload = status(getContext()).toString().getBytes(StandardCharsets.UTF_8);
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
