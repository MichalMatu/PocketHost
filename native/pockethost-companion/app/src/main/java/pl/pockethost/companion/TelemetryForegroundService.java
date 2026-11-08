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
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;
import rikka.shizuku.Shizuku;

/**
 * Owner-enabled Android foreground service keeps the read-only Shizuku bridge
 * unfrozen when the app is no longer visible. No remote command interface.
 */
public final class TelemetryForegroundService extends Service {
    public static final String ACTION_STOP = "pl.pockethost.companion.STOP_TELEMETRY";
    public static final String PREF_ENABLED = "backgroundTelemetryEnabled";
    private static final String CHANNEL = "pockethost-cpu";
    private static final int NOTIFICATION_ID = 52;
    private static final long SAMPLE_MS = 15000L;
    private static final String TAG = "PocketHostTelemetry";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService samples = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile IPowerUserService source;
    private boolean bound;
    private boolean destroyed;

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
            .daemon(false).processNameSuffix("telemetry").debuggable(false).version(2);

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
                snapshot.put("capabilities", capabilities);
                getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE).edit()
                        .putString("snapshot", snapshot.toString())
                        .putLong("observedAtMs", System.currentTimeMillis()).apply();
            } catch (Exception e) {
                Log.w(TAG, "CPU sample unavailable: " + e.getClass().getSimpleName());
            } finally {
                busy.set(false);
            }
        });
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onDestroy() {
        destroyed = true;
        handler.removeCallbacks(tick);
        Shizuku.removeBinderReceivedListener(binderListener);
        Shizuku.removeBinderDeadListener(binderDead);
        if (bound) {
            try { Shizuku.unbindUserService(args, connection, false); }
            catch (RuntimeException ignored) {}
        }
        samples.shutdownNow();
        super.onDestroy();
    }
}
