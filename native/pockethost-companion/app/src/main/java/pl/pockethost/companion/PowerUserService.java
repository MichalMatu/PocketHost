package pl.pockethost.companion;

import android.os.RemoteException;
import android.system.Os;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.concurrent.TimeUnit;
import java.util.Set;
import java.util.TreeSet;
import org.json.JSONArray;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * Runs only inside a Shizuku UserService at the actual shell/root UID.
 * No HTTP listener, no arbitrary remote commands; this initial method
 * returns a bounded structured CPU/process snapshot.
 */
public final class PowerUserService extends IPowerUserService.Stub {
    private static final Pattern TOTAL_CPU =
            Pattern.compile("(?m)^\\s*(\\d+(?:\\.\\d+)?)%\\s+TOTAL:");

    public PowerUserService() {}

    @Override
    public String readCpuAndProcesses() throws RemoteException {
        try {
            final int uid = Os.getuid();
            if (uid != 2000 && uid != 0) {
                throw new SecurityException("Shizuku process does not run as shell/root");
            }
            String cpu = execute(8192, "/system/bin/dumpsys", "cpuinfo");
            Matcher match = TOTAL_CPU.matcher(cpu);
            double percent = match.find() ? Double.parseDouble(match.group(1)) : -1;
            String processes = execute(24576, "/system/bin/ps", "-A", "-o", "PID");
            int count = 0;
            for (String line : processes.split("\\R")) {
                if (line.trim().matches("[0-9]+")) count++;
            }

            JSONObject snapshot = new JSONObject();
            snapshot.put("version", 1);
            snapshot.put("source", "shizuku-user-service");
            snapshot.put("uid", uid);
            snapshot.put("cpuPercent", percent >= 0 && percent <= 100 ? percent : JSONObject.NULL);
            snapshot.put("visibleProcesses", count > 0 ? count : JSONObject.NULL);
            snapshot.put("observedAtMs", System.currentTimeMillis());
            return snapshot.toString();
        } catch (Exception e) {
            throw new RemoteException("Failed to read CPU/processes: " + e.getClass().getSimpleName());
        }
    }

    /** Bounded Android package inventory, separated from Termux package management. */
    @Override
    public String readInstalledPackages() throws RemoteException {
        try {
            int uid = Os.getuid();
            if (uid != 2000 && uid != 0) {
                throw new SecurityException("Shizuku process does not run as shell/root");
            }
            Set<String> all = packageNames(execute(131072, "/system/bin/pm", "list", "packages"));
            Set<String> user = packageNames(execute(131072, "/system/bin/pm", "list", "packages", "-3"));
            JSONArray apps = new JSONArray();
            int count = 0;
            for (String name : all) {
                if (count++ >= 512) break;
                JSONObject entry = new JSONObject();
                entry.put("packageName", name);
                entry.put("system", !user.contains(name));
                apps.put(entry);
            }
            JSONObject snapshot = new JSONObject();
            snapshot.put("version", 1);
            snapshot.put("source", "shizuku-user-service");
            snapshot.put("uid", uid);
            snapshot.put("observedAt", java.time.Instant.now().toString());
            snapshot.put("packages", apps);
            snapshot.put("truncated", all.size() > 512);
            return snapshot.toString();
        } catch (Exception e) {
            throw new RemoteException("Failed to read Android packages: " + e.getClass().getSimpleName());
        }
    }

    private static Set<String> packageNames(String raw) {
        Set<String> result = new TreeSet<>();
        for (String line : raw.split("\\R")) {
            if (!line.startsWith("package:")) continue;
            String name = line.substring(8).trim();
            if (name.length() <= 200 &&
                    name.matches("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+")) {
                result.add(name);
            }
        }
        return result;
    }

    private static String execute(int limit, String... argv) throws Exception {
        Process process = new ProcessBuilder(argv).redirectErrorStream(true).start();
        ExecutorService reader = Executors.newSingleThreadExecutor();
        try {
            Future<String> output = reader.submit(() -> {
                StringBuilder result = new StringBuilder();
                try (BufferedReader input = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = input.readLine()) != null) {
                        // Dumpsys cpuinfo puts TOTAL near the end; retain a
                        // bounded tail rather than the first processes only.
                        result.append(line).append('\n');
                        if (result.length() > limit) {
                            result.delete(0, result.length() - limit);
                        }
                    }
                }
                return result.toString();
            });
            if (!process.waitFor(7, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Android system sampling timed out");
            }
            if (process.exitValue() != 0) {
                throw new IllegalStateException("Android system command rejected");
            }
            return output.get(2, TimeUnit.SECONDS);
        } finally {
            process.destroyForcibly();
            reader.shutdownNow();
        }
    }

    @Override
    public void destroy() {
        System.exit(0);
    }
}
