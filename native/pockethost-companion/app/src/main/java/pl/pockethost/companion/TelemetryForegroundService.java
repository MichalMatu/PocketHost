package pl.pockethost.companion;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;
import rikka.shizuku.Shizuku;

/**
 * Owner-enabled Android foreground service keeps the read-only Shizuku bridge
 * unfrozen when the app is no longer visible. A user-triggered shell
 * operation can reuse this authorized Shizuku Binder from phone loopback.
 */
public final class TelemetryForegroundService extends Service {
    public static final String ACTION_STOP = "pl.pockethost.companion.STOP_TELEMETRY";
    public static final String PREF_ENABLED = "backgroundTelemetryEnabled";
    private static final String CHANNEL = "pockethost-cpu";
    private static final int NOTIFICATION_ID = 52;
    private static final long SAMPLE_MS = 15000L;
    private static final long APPS_REFRESH_MS = 120000L;
    private static final long SYSTEM_REFRESH_MS = 30000L;
    private static final String TAG = "PocketHostTelemetry";
    private static volatile TelemetryForegroundService activeInstance;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService samples = Executors.newSingleThreadExecutor();
    private final ExecutorService inventories = Executors.newSingleThreadExecutor();
    private final ExecutorService shellCommands = Executors.newSingleThreadExecutor();
    private final AtomicBoolean shellBusy = new AtomicBoolean(false);
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final AtomicBoolean inventoryBusy = new AtomicBoolean(false);
    private volatile IPowerUserService source;
    private boolean bound;
    private boolean destroyed;
    private volatile long lastAppsAt;
    private volatile long lastSystemAt;

    private final Shizuku.OnBinderReceivedListener binderListener = () ->
            handler.post(this::ensureBound);
    private final Shizuku.OnBinderDeadListener binderDead = () -> handler.post(() -> {
        source = null;
        bound = false;
    });
    private final ServiceConnection connection = new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName name, IBinder binder) {
            source = IPowerUserService.Stub.asInterface(binder);
            handler.post(TelemetryForegroundService.this::sample);
        }
        @Override public void onServiceDisconnected(ComponentName name) {
            source = null;
            bound = false;
        }
    };
    private final Shizuku.UserServiceArgs args = new Shizuku.UserServiceArgs(
            new ComponentName("pl.pockethost.companion", PowerUserService.class.getName()))
            .daemon(false).processNameSuffix("telemetry").debuggable(false).version(5);

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (destroyed) return;
            ensureBound();
            sample();
            handler.postDelayed(this, SAMPLE_MS);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        activeInstance = this;
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL,
                "PocketHost Android telemetry", NotificationManager.IMPORTANCE_LOW));
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent content = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentTitle("PocketHost Android monitoring")
                .setContentText("Shizuku CPU and process telemetry is active")
                .setContentIntent(content)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        TelemetryHttpServer.start(getApplicationContext());
        Shizuku.addBinderReceivedListenerSticky(binderListener);
        Shizuku.addBinderDeadListener(binderDead);
        handler.post(tick);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE)
                    .edit().putBoolean(PREF_ENABLED, false).apply();
            stopSelf();
            return START_NOT_STICKY;
        }
        ensureBound();
        return START_STICKY;
    }

    private void ensureBound() {
        if (destroyed || bound) return;
        try {
            if (!Shizuku.pingBinder() || Shizuku.isPreV11() ||
                    Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) return;
            bound = true;
            Shizuku.bindUserService(args, connection);
        } catch (RuntimeException e) {
            bound = false;
            Log.w(TAG, "Shizuku bind unavailable: " + e.getClass().getSimpleName());
        }
    }

    private void sample() {
        IPowerUserService remote = source;
        if (remote == null || !busy.compareAndSet(false, true)) return;
        samples.execute(() -> {
            try {
                JSONObject data = new JSONObject(remote.readCpuAndProcesses());
                int uid = data.getInt("uid");
                if (uid != 0 && uid != 2000) throw new SecurityException("Not Shizuku shell/root");
                JSONObject snapshot = new JSONObject();
                snapshot.put("version", 1);
                snapshot.put("source", "android-companion");
                snapshot.put("connected", true);
                snapshot.put("authorized", true);
                snapshot.put("mode", uid == 0 ? "root" : "adb");
                snapshot.put("uid", uid);
                snapshot.put("observedAt", java.time.Instant.now().toString());
                snapshot.put("cpuPercent", data.opt("cpuPercent"));
                snapshot.put("visibleProcesses", data.opt("visibleProcesses"));
                JSONArray capabilities = new JSONArray();
                JSONObject cpu = new JSONObject();
                cpu.put("id", "cpu-and-processes");
                cpu.put("title", "Android CPU and processes");
                cpu.put("available", !data.isNull("cpuPercent"));
                cpu.put("description", "Live Shizuku UserService");
                capabilities.put(cpu);
                for (String feature : new String[] {"apps", "processes", "permissions",
                        "services", "settings", "advanced-shell"}) {
                    JSONObject cap = new JSONObject();
                    cap.put("id", feature);
                    cap.put("title", feature.replace('-', ' '));
                    cap.put("available", true);
                    cap.put("description", "Shizuku Binder operation available; Android may refuse a target");
                    capabilities.put(cap);
                }
                snapshot.put("capabilities", capabilities);
                getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE).edit()
                        .putString("snapshot", snapshot.toString())
                        .putLong("observedAtMs", System.currentTimeMillis()).apply();
                refreshInventories(remote, uid);
            } catch (Exception e) {
                Log.w(TAG, "CPU sample unavailable: " + e.getClass().getSimpleName());
            } finally {
                busy.set(false);
            }
        });
    }


    private void refreshInventories(IPowerUserService remote, int uid) {
        long now = System.currentTimeMillis();
        if (now - lastSystemAt < SYSTEM_REFRESH_MS &&
                now - lastAppsAt < APPS_REFRESH_MS) return;
        if (!inventoryBusy.compareAndSet(false, true)) return;
        inventories.execute(() -> {
            try {
                // Slow diagnostic commands must never block the 15s CPU sampler.
                if (System.currentTimeMillis() - lastSystemAt >= SYSTEM_REFRESH_MS) {
                    try {
                        JSONObject overview = new JSONObject(remote.readSystemOverview());
                        if (overview.getInt("uid") != uid ||
                                !"shizuku-user-service".equals(overview.getString("source"))) {
                            throw new SecurityException("Unexpected overview source");
                        }
                        getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE).edit()
                                .putString("systemSnapshot", overview.toString())
                                .putLong("systemAtMs", System.currentTimeMillis()).apply();
                        lastSystemAt = System.currentTimeMillis();
                    } catch (Exception e) {
                        Log.w(TAG, "Android system overview unavailable: " +
                                e.getClass().getSimpleName());
                    }
                }
                if (System.currentTimeMillis() - lastAppsAt >= APPS_REFRESH_MS) {
                    try {
                        JSONObject inventory = new JSONObject(remote.readInstalledPackages());
                        if (inventory.getInt("uid") != uid ||
                                !"shizuku-user-service".equals(inventory.getString("source"))) {
                            throw new SecurityException("Unexpected package inventory source");
                        }
                        getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE).edit()
                                .putString("appsSnapshot", inventory.toString())
                                .putLong("appsAtMs", System.currentTimeMillis()).apply();
                        lastAppsAt = System.currentTimeMillis();
                    } catch (Exception e) {
                        Log.w(TAG, "Android package inventory unavailable: " +
                                e.getClass().getSimpleName());
                    }
                }
            } finally {
                inventoryBusy.set(false);
            }
        });
    }

    /**
     * Owner-initiated browser Run action. This is intentionally direct:
     * no pairing code and no secondary phone approval. Android's actual
     * Shizuku UID and Binder authorization still define real capabilities.
     * Executes via the same native service as local Advanced Shell.
     */
    public static String runBrowserShell(String command) throws Exception {
        TelemetryForegroundService owner = activeInstance;
        if (owner == null || owner.destroyed) {
            throw new IllegalStateException("PocketHost Companion monitoring is not active");
        }
        if (command == null || command.isBlank() || command.length() > 240 ||
                command.indexOf((char) 0) >= 0) {
            throw new IllegalArgumentException("Invalid Android shell command (1..240 characters)");
        }
        IPowerUserService remote = owner.source;
        if (remote == null) {
            throw new IllegalStateException("Shizuku is not connected or authorized");
        }
        if (!owner.shellBusy.compareAndSet(false, true)) {
            throw new IllegalStateException("A shell command is already running");
        }
        try {
            Future<String> result = owner.shellCommands.submit(
                    () -> remote.runOwnerAction("shell", command, ""));
            try {
                return result.get(13, TimeUnit.SECONDS);
            } catch (java.util.concurrent.TimeoutException e) {
                result.cancel(true);
                throw e;
            }
        } finally {
            owner.shellBusy.set(false);
        }
    }


    /** Direct browser owner action, serialized with shell; no phone confirmation. */
    public static String runBrowserAction(String action, String target, String value) throws Exception {
        if (action == null || !java.util.Set.of("launch", "force-stop", "enable", "disable",
                "uninstall", "grant", "revoke", "process-stop", "service-start",
                "service-stop", "brightness", "timeout").contains(action) ||
                target == null || target.length() > 240 ||
                value == null || value.length() > 240) {
            throw new IllegalArgumentException("Invalid typed Android action");
        }
        TelemetryForegroundService owner = activeInstance;
        if (owner == null || owner.destroyed || owner.source == null) {
            throw new IllegalStateException("Shizuku is not connected or authorized");
        }
        if (!owner.shellBusy.compareAndSet(false, true)) {
            throw new IllegalStateException("Another Android action is running");
        }
        try {
            IPowerUserService remote = owner.source;
            Future<String> result = owner.shellCommands.submit(
                    () -> remote.runOwnerAction(action, target, value));
            try {
                return result.get(13, TimeUnit.SECONDS);
            } catch (java.util.concurrent.TimeoutException e) {
                result.cancel(true);
                throw e;
            }
        } finally {
            owner.shellBusy.set(false);
        }
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onDestroy() {
        destroyed = true;
        if (activeInstance == this) activeInstance = null;
        handler.removeCallbacks(tick);
        Shizuku.removeBinderReceivedListener(binderListener);
        Shizuku.removeBinderDeadListener(binderDead);
        if (bound) {
            try { Shizuku.unbindUserService(args, connection, false); }
            catch (RuntimeException ignored) {}
        }
        samples.shutdownNow();
        inventories.shutdownNow();
        shellCommands.shutdownNow();
        super.onDestroy();
    }
}
