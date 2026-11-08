package pl.pockethost.companion;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.IBinder;
import android.os.RemoteException;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import rikka.shizuku.Shizuku;

public final class MainActivity extends Activity {
    private static final int SHIZUKU_PERMISSION_REQUEST = 6001;
    private final ExecutorService readings = Executors.newSingleThreadExecutor();
    private TextView status;
    private TextView reading;
    private IPowerUserService powerService;
    private boolean bound = false;
    private boolean telemetryServiceStarted = false;
    private boolean visible = false;
    private final AtomicBoolean sampling = new AtomicBoolean(false);
    private final Handler refreshLoop = new Handler(Looper.getMainLooper());
    private final Runnable onDemandRefresh = new Runnable() {
        @Override public void run() {
            if (!visible) return;
            if (permissionGranted()) bindAndSample();
            refreshLoop.postDelayed(this, 10000);
        }
    };

    private final Shizuku.OnBinderReceivedListener binderReceived = () -> runOnUiThread(this::refreshConnection);
    private final Shizuku.OnBinderDeadListener binderDead = () -> runOnUiThread(() -> {
        powerService = null;
        bound = false;
        refreshConnection();
    });
    private final Shizuku.OnRequestPermissionResultListener permissionResult = (code, result) -> {
        if (code != SHIZUKU_PERMISSION_REQUEST) return;
        runOnUiThread(() -> {
            refreshConnection();
            if (result == PackageManager.PERMISSION_GRANTED) enableContinuousMonitoring();
        });
    };
    private final ServiceConnection connection = new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName name, IBinder binder) {
            powerService = IPowerUserService.Stub.asInterface(binder);
            runOnUiThread(() -> status.setText("Shizuku authorized; native service connected"));
            sample();
        }
        @Override public void onServiceDisconnected(ComponentName name) {
            powerService = null;
            bound = false;
            runOnUiThread(() -> status.setText("Shizuku service disconnected"));
        }
    };
    private final Shizuku.UserServiceArgs serviceArgs =
            new Shizuku.UserServiceArgs(
                new ComponentName("pl.pockethost.companion", PowerUserService.class.getName()))
                .daemon(false)
                .processNameSuffix("telemetry")
                .debuggable(false)
                .version(4);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TelemetryHttpServer.start(getApplicationContext());
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 40, 32, 32);
        TextView heading = new TextView(this);
        heading.setText("PocketHost • Android & Shizuku");
        heading.setTextSize(22);
        layout.addView(heading);
        status = new TextView(this);
        status.setPadding(0, 24, 0, 24);
        layout.addView(status);
        Button authorize = new Button(this);
        authorize.setText("Authorize with Shizuku");
        authorize.setOnClickListener(v -> requestAccess());
        layout.addView(authorize);
        Button cpu = new Button(this);
        cpu.setText("Read Android CPU and processes");
        cpu.setOnClickListener(v -> enableContinuousMonitoring());
        layout.addView(cpu);
        Button stop = new Button(this);
        stop.setText("Stop background CPU monitoring");
        stop.setOnClickListener(v -> {
            getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE).edit()
                    .putBoolean(TelemetryForegroundService.PREF_ENABLED, false).apply();
            stopService(new Intent(this, TelemetryForegroundService.class));
            telemetryServiceStarted = false;
            status.setText("Background CPU monitoring stopped");
        });
        layout.addView(stop);
        reading = new TextView(this);
        reading.setPadding(0, 20, 0, 0);
        reading.setText("No privileged CPU sample yet.");
        reading.setTextIsSelectable(true);
        layout.addView(reading);
        setContentView(layout);

        Shizuku.addBinderReceivedListenerSticky(binderReceived);
        Shizuku.addBinderDeadListener(binderDead);
        Shizuku.addRequestPermissionResultListener(permissionResult);
        refreshConnection();
        if (permissionGranted() &&
                getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE)
                  .getBoolean(TelemetryForegroundService.PREF_ENABLED, false)) {
            startContinuousService();
        }
    }

    private boolean permissionGranted() {
        try {
            return Shizuku.pingBinder() && !Shizuku.isPreV11() &&
                    Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private void refreshConnection() {
        try {
            if (!Shizuku.pingBinder()) {
                status.setText("Shizuku server unavailable. Start Shizuku in Android.");
                return;
            }
            if (Shizuku.isPreV11()) {
                status.setText("Shizuku API v11 or newer required.");
                return;
            }
            int uid = Shizuku.getUid();
            String mode = uid == 0 ? "root" : uid == 2000 ? "ADB shell" : "UID " + uid;
            status.setText("Shizuku running (" + mode + ") • " +
                    (permissionGranted() ? "authorized" : "not authorized"));
        } catch (RuntimeException e) {
            status.setText("Shizuku state unavailable: " + e.getClass().getSimpleName());
        }
    }

    private void enableContinuousMonitoring() {
        if (!permissionGranted()) {
            requestAccess();
            return;
        }
        getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE).edit()
                .putBoolean(TelemetryForegroundService.PREF_ENABLED, true).apply();
        startContinuousService();
        bindAndSample();
    }

    private void startContinuousService() {
        if (telemetryServiceStarted) return;
        try {
            Intent intent = new Intent(this, TelemetryForegroundService.class);
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent);
            else startService(intent);
            telemetryServiceStarted = true;
        } catch (RuntimeException e) {
            status.setText("Background monitoring unavailable: " + e.getClass().getSimpleName());
        }
    }

    private void requestAccess() {
        try {
            if (!Shizuku.pingBinder()) {
                refreshConnection();
            } else if (permissionGranted()) {
                bindAndSample();
            } else if (Shizuku.shouldShowRequestPermissionRationale()) {
                status.setText("Permission denied. Review this app in Shizuku Manager.");
            } else {
                Shizuku.requestPermission(SHIZUKU_PERMISSION_REQUEST);
            }
        } catch (RuntimeException e) {
            status.setText("Shizuku permission request failed: " + e.getClass().getSimpleName());
        }
    }

    private void bindAndSample() {
        if (!permissionGranted()) {
            requestAccess();
            return;
        }
        if (powerService != null) {
            sample();
            return;
        }
        if (bound) return;
        try {
            bound = true;
            status.setText("Connecting to Shizuku user service…");
            Shizuku.bindUserService(serviceArgs, connection);
        } catch (RuntimeException e) {
            bound = false;
            status.setText("Shizuku bind failed: " + e.getClass().getSimpleName());
        }
    }

    private void sample() {
        IPowerUserService source = powerService;
        if (source == null || !sampling.compareAndSet(false, true)) return;
        reading.setText("Reading Android CPU…");
        readings.execute(() -> {
            try {
                JSONObject json = new JSONObject(source.readCpuAndProcesses());
                String cpu = json.isNull("cpuPercent") ? "Unavailable" : json.getString("cpuPercent") + "%";
                String processes = json.isNull("visibleProcesses") ? "Unavailable" : json.getString("visibleProcesses");
                int uid = json.getInt("uid");
                JSONObject snapshot = new JSONObject();
                snapshot.put("version", 1);
                snapshot.put("source", "android-companion");
                snapshot.put("connected", true);
                snapshot.put("authorized", true);
                snapshot.put("mode", uid == 0 ? "root" : "adb");
                snapshot.put("observedAt", new java.util.Date().toInstant().toString());
                snapshot.put("cpuPercent", json.opt("cpuPercent"));
                snapshot.put("visibleProcesses", json.opt("visibleProcesses"));
                org.json.JSONArray capabilities = new org.json.JSONArray();
                JSONObject capability = new JSONObject();
                capability.put("id", "cpu-and-processes");
                capability.put("title", "Android CPU and processes");
                capability.put("available", !json.isNull("cpuPercent"));
                capability.put("description", "On-device Shizuku UserService");
                capabilities.put(capability);
                snapshot.put("capabilities", capabilities);
                getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE).edit()
                    .putString("snapshot", snapshot.toString())
                    .putLong("observedAtMs", System.currentTimeMillis()).apply();
                runOnUiThread(() -> reading.setText("Android CPU: " + cpu +
                        "\nVisible processes: " + processes + "\nShizuku UID: " + uid));
            } catch (Exception e) {
                runOnUiThread(() -> reading.setText("Android measurement failed: " +
                        e.getClass().getSimpleName()));
            } finally {
                sampling.set(false);
            }
        });
    }

    @Override protected void onResume() {
        super.onResume();
        visible = true;
        if (permissionGranted() &&
                getSharedPreferences(TelemetryProvider.PREFS, MODE_PRIVATE)
                  .getBoolean(TelemetryForegroundService.PREF_ENABLED, false)) {
            startContinuousService();
        }
        refreshLoop.removeCallbacks(onDemandRefresh);
        refreshLoop.post(onDemandRefresh);
    }

    @Override protected void onPause() {
        visible = false;
        refreshLoop.removeCallbacks(onDemandRefresh);
        super.onPause();
    }

    @Override protected void onDestroy() {
        Shizuku.removeBinderReceivedListener(binderReceived);
        Shizuku.removeBinderDeadListener(binderDead);
        Shizuku.removeRequestPermissionResultListener(permissionResult);
        readings.shutdownNow();
        if (bound) {
            try { Shizuku.unbindUserService(serviceArgs, connection, false); }
            catch (RuntimeException ignored) {}
        }
        super.onDestroy();
    }
}
