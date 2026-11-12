package pl.pockethost.runtimeprobe;

import android.app.Activity;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public final class ProbeActivity extends Activity {
    private static final long READY_TIMEOUT_MS = 5000L;
    private final ExecutorService runner = Executors.newSingleThreadExecutor();
    private final List<Process> ownedProcesses = new ArrayList<>();
    private TextView state;
    private Button start;
    private volatile boolean testing;

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(32, 48, 32, 32);
        TextView title = new TextView(this);
        title.setText("PocketHost S1 — independent APK execution");
        title.setTextSize(20f);
        body.addView(title);
        TextView scope = new TextView(this);
        scope.setText("Disposable ARM64 C executable. NOT a Node.js host or Termux replacement. "
                + "Never connects to existing Termux, Shizuku, Companion or production services.");
        body.addView(scope);
        start = new Button(this);
        start.setText("Run two isolated processes");
        start.setOnClickListener(v -> beginTest());
        body.addView(start);
        Button cancel = new Button(this);
        cancel.setText("Stop this app's workers");
        cancel.setOnClickListener(v -> {
            stopAll();
            state.setText("Stopped this app's workers. No other processes were signalled.");
        });
        body.addView(cancel);
        state = new TextView(this);
        state.setText("Ready; no processes have been started.");
        body.addView(state);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(body, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);
    }

    private static final class Worker {
        final Process process;
        final String id;
        final int pid;
        final int port;
        Worker(Process process, String id, int pid, int port) {
            this.process = process; this.id = id; this.pid = pid; this.port = port;
        }
    }

    private void beginTest() {
        if (testing) return;
        testing = true;
        start.setEnabled(false);
        state.setText("Starting only owned processes...");
        runner.execute(() -> {
            String report;
            try {
                Worker one = launch("one");
                Worker two = launch("two");
                if (one.pid == two.pid || one.port == two.port)
                    throw new IllegalStateException("Workers are not independent");
                health(one);
                health(two);
                stop(one.process);
                health(two); // The other worker must remain reachable.
                Worker replacement = launch("replacement");
                health(replacement);
                report = "PASS: two separate ARM64 workers, distinct loopback ports, "
                        + "independent stop, replacement startup. "
                        + "Node.js in APK is NOT proven yet.";
            } catch (Exception error) {
                report = "FAIL / HOLD: " + error.getClass().getSimpleName() + ": "
                        + String.valueOf(error.getMessage());
            } finally {
                stopAll();
            }
            final String finalReport = report;
            runOnUiThread(() -> {
                if (!isDestroyed()) {
                    state.setText(finalReport);
                    testing = false;
                    start.setEnabled(true);
                }
            });
        });
    }

    private Worker launch(String id) throws Exception {
        if (!id.equals("one") && !id.equals("two") && !id.equals("replacement"))
            throw new IllegalArgumentException("Invalid worker identity");
        File binary = new File(getApplicationInfo().nativeLibraryDir, "libpockethost_probe.so");
        if (!binary.isFile() || !binary.canExecute())
            throw new IllegalStateException("Packaged executable is unavailable");
        Process process = new ProcessBuilder(binary.getAbsolutePath(), id)
                .redirectErrorStream(true).start();
        synchronized (ownedProcesses) { ownedProcesses.add(process); }
        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
        StringBuilder line = new StringBuilder();
        long deadline = SystemClock.elapsedRealtime() + READY_TIMEOUT_MS;
        while (SystemClock.elapsedRealtime() < deadline && !Thread.currentThread().isInterrupted()) {
            if (reader.ready()) {
                int next = reader.read();
                if (next == '\n') break;
                if (next < 0 || line.length() >= 256)
                    throw new IllegalStateException("Invalid worker readiness data");
                line.append((char)next);
            } else if (!process.isAlive()) {
                throw new IllegalStateException("Owned worker exited before readiness");
            } else {
                Thread.sleep(25);
            }
        }
        if (line.isEmpty() || !line.toString().endsWith("}"))
            throw new IllegalStateException("Owned worker readiness timed out");
        JSONObject ready = new JSONObject(line.toString());
        int pid = ready.getInt("pid"), port = ready.getInt("port");
        if (!id.equals(ready.getString("id")) || pid <= 0 || port <= 0 || port > 65535)
            throw new IllegalStateException("Owned worker identity mismatch");
        return new Worker(process, id, pid, port);
    }

    private static void health(Worker worker) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(
                "http://127.0.0.1:" + worker.port + "/health").openConnection();
        connection.setConnectTimeout(1500);
        connection.setReadTimeout(1500);
        connection.setRequestMethod("GET");
        try {
            if (connection.getResponseCode() != 200)
                throw new IllegalStateException("Owned worker health failed");
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(connection.getInputStream()));
            JSONObject value = new JSONObject(reader.readLine());
            if (!worker.id.equals(value.getString("id")) || worker.pid != value.getInt("pid"))
                throw new IllegalStateException("Worker identity changed");
        } finally {
            connection.disconnect();
        }
    }

    private static void stop(Process process) {
        if (process == null || !process.isAlive()) return;
        process.destroy();
        try {
            if (!process.waitFor(2, TimeUnit.SECONDS)) process.destroyForcibly();
        } catch (InterruptedException error) {
            process.destroyForcibly();
            Thread.currentThread().interrupt();
        }
    }

    private void stopAll() {
        synchronized (ownedProcesses) {
            for (Process process : ownedProcesses) stop(process);
            ownedProcesses.clear();
        }
    }

    @Override protected void onDestroy() {
        stopAll();
        runner.shutdownNow();
        super.onDestroy();
    }
}
