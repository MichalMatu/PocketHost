package pl.pockethost.companion;

import android.app.Activity;
import android.app.AlertDialog;
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
import android.widget.EditText;
import android.widget.ScrollView;
import android.graphics.Typeface;

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
    private TextView ownerResult;
    private LinearLayout ownerSection;
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
        TextView ownerTitle = new TextView(this);
        ownerTitle.setText("Local Android power-user controls");
        ownerTitle.setTextSize(20);
        ownerTitle.setTypeface(null, Typeface.BOLD);
        ownerTitle.setPadding(0, 30, 0, 12);
        layout.addView(ownerTitle);
        TextView ownerWarning = new TextView(this);
        ownerWarning.setText("Actions below execute ONLY inside this phone app after confirmation. " +
                "The PocketHost LAN dashboard remains read-only. Shizuku ADB is not root.");
        layout.addView(ownerWarning);
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.VERTICAL);
        layout.addView(toolbar);
        ownerSection = new LinearLayout(this);
        ownerSection.setOrientation(LinearLayout.VERTICAL);
        layout.addView(ownerSection);
        ownerResult = new TextView(this);
        ownerResult.setPadding(0, 22, 0, 40);
        ownerResult.setTextIsSelectable(true);
        ownerResult.setText("Select a section; no privileged action is automatic.");
        layout.addView(ownerResult);
        addTab(toolbar, "Applications", this::showApplications);
        addTab(toolbar, "CPU & processes", this::showProcesses);
        addTab(toolbar, "Permissions", this::showPermissions);
        addTab(toolbar, "Services & settings", this::showServices);
        addTab(toolbar, "Advanced shell", this::showShell);
        addTab(toolbar, "Power & hardware", this::showPower);
        showApplications();
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.addView(layout);
        setContentView(scroll);

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


    private void addTab(LinearLayout parent, String name, Runnable handler) {
        Button item = new Button(this);
        item.setText(name);
        item.setAllCaps(false);
        item.setOnClickListener(v -> handler.run());
        parent.addView(item);
    }

    private void section(String title, String hint) {
        ownerSection.removeAllViews();
        TextView heading = new TextView(this);
        heading.setText(title);
        heading.setTextSize(18);
        heading.setTypeface(null, Typeface.BOLD);
        heading.setPadding(0, 16, 0, 6);
        ownerSection.addView(heading);
        TextView description = new TextView(this);
        description.setText(hint);
        description.setPadding(0, 0, 0, 12);
        ownerSection.addView(description);
    }

    private EditText field(String hint) {
        EditText entry = new EditText(this);
        entry.setSingleLine(true);
        entry.setHint(hint);
        ownerSection.addView(entry);
        return entry;
    }

    private void action(String title, String operation, EditText target, EditText value) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(title);
        button.setOnClickListener(v -> confirmOperation(operation,
                target == null ? "" : target.getText().toString().trim(),
                value == null ? "" : value.getText().toString().trim()));
        ownerSection.addView(button);
    }

    private void inspect(String heading, java.util.concurrent.Callable<String> reading) {
        if (!permissionGranted() || powerService == null) {
            ownerResult.setText("Shizuku user service not connected. Authorize and start monitoring first.");
            bindAndSample();
            return;
        }
        ownerResult.setText("Reading " + heading + "...");
        readings.execute(() -> {
            try {
                String content = reading.call();
                if (content.length() > 18000) content = content.substring(0, 18000) + "\n[truncated]";
                final String result = content;
                runOnUiThread(() -> ownerResult.setText(result));
            } catch (Exception failure) {
                runOnUiThread(() -> ownerResult.setText("Android read rejected: " +
                        failure.getClass().getSimpleName() + ": " + failure.getMessage()));
            }
        });
    }

    private void showApplications() {
        section("Applications", "Inspect the selected Android package, launch it, force-stop it, " +
                "or uninstall for the current Android user after explicit confirmation.");
        EditText pkg = field("Package name (e.g. com.example.app)");
        Button details = new Button(this);
        details.setText("Read app details / permissions");
        details.setAllCaps(false);
        details.setOnClickListener(v -> inspect("app details",
                () -> new JSONObject(powerService.inspectApp(pkg.getText().toString().trim()))
                        .toString(2)));
        ownerSection.addView(details);
        action("Launch application", "launch", pkg, null);
        action("Force-stop application", "force-stop", pkg, null);
        action("Uninstall for Android user 0", "uninstall", pkg, null);
    }

    private void showProcesses() {
        section("CPU & processes", "Inspect observed PIDs and memory, then optionally send TERM to " +
                "a specifically selected PID. Killing a system process may disrupt Android.");
        Button refresh = new Button(this);
        refresh.setText("Read live process inventory");
        refresh.setOnClickListener(v -> inspect("processes",
                () -> new JSONObject(powerService.readSystemOverview())
                        .getJSONArray("processes").toString(2)));
        ownerSection.addView(refresh);
        EditText pid = field("Exact process PID");
        action("Send TERM to selected PID", "process-stop", pid, null);
    }

    private void showPermissions() {
        section("Permissions", "Inspect a package in Applications first. Android will reject " +
                "grants or revocations outside actual ADB/root privileges or non-runtime permissions.");
        EditText pkg = field("Exact package name");
        EditText permission = field("android.permission.CAMERA");
        action("Grant selected runtime permission", "grant", pkg, permission);
        action("Revoke selected runtime permission", "revoke", pkg, permission);
    }

    private void showServices() {
        section("Services & settings", "Service components require their exact package/class name. " +
                "Android may reject non-exported services or settings.");
        Button summary = new Button(this);
        summary.setText("Read service and settings observations");
        summary.setOnClickListener(v -> inspect("services and settings", () -> {
            JSONObject data = new JSONObject(powerService.readSystemOverview());
            JSONObject limited = new JSONObject();
            limited.put("services", data.getJSONObject("services"));
            limited.put("settings", data.getJSONObject("settings"));
            return limited.toString(2);
        }));
        ownerSection.addView(summary);
        EditText component = field("com.example.app/.ExampleService");
        action("Start selected service", "service-start", component, null);
        action("Stop selected service", "service-stop", component, null);
        EditText brightness = field("Brightness value 0–255");
        action("Set screen brightness", "brightness", null, brightness);
        EditText timeout = field("Screen timeout milliseconds (15000–3600000)");
        action("Set screen timeout", "timeout", null, timeout);
    }

    private void showShell() {
        section("Advanced shell", "Runs the exact typed command with the current Shizuku shell/root UID. " +
                "Review every command: it may alter or remove Android data. No LAN shell endpoint exists.");
        EditText command = field("Android shell command (max 240 characters)");
        action("Review and execute on this phone", "shell", command, null);
    }

    private void showPower() {
        section("Power & hardware", "Shizuku-backed battery level, temperature, available RAM and " +
                "device settings. Missing readings remain unavailable.");
        Button summary = new Button(this);
        summary.setText("Read power and hardware");
        summary.setOnClickListener(v -> inspect("power and hardware", () -> {
            JSONObject data = new JSONObject(powerService.readSystemOverview());
            return data.getJSONObject("power").toString(2);
        }));
        ownerSection.addView(summary);
    }

    private void confirmOperation(String operation, String target, String value) {
        if (!permissionGranted() || powerService == null) {
            ownerResult.setText("Shizuku permission or user service is missing.");
            bindAndSample();
            return;
        }
        if (target.isEmpty() && !operation.equals("brightness") && !operation.equals("timeout")) {
            ownerResult.setText("Select an exact target before executing.");
            return;
        }
        String description = "Operation: " + operation + "\nTarget: " + target +
                (value.isEmpty() ? "" : "\nValue: " + value) +
                "\n\nRuns as " + (Shizuku.getUid() == 0 ? "root" : "ADB shell") +
                " on this phone. Changes may be permanent. Continue?";
        new AlertDialog.Builder(this)
                .setTitle("Confirm Android operation")
                .setMessage(description)
                .setNegativeButton("Cancel", (dialog, choice) -> ownerResult.setText("Cancelled"))
                .setPositiveButton("Execute", (dialog, choice) -> {
                    IPowerUserService active = powerService;
                    ownerResult.setText("Android operation in progress...");
                    readings.execute(() -> {
                        try {
                            String json = active.runOwnerAction(operation, target, value);
                            JSONObject response = new JSONObject(json);
                            runOnUiThread(() -> ownerResult.setText(response.toString()));
                        } catch (Exception failure) {
                            runOnUiThread(() -> ownerResult.setText(
                                    "Android operation failed/refused: " +
                                    failure.getClass().getSimpleName() + ": " + failure.getMessage()));
                        }
                    });
                }).show();
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
