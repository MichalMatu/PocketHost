package pl.pockethost.companion;

import android.os.RemoteException;
import android.system.Os;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.concurrent.TimeUnit;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;
import org.json.JSONArray;
import java.util.Locale;
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
                if (count++ >= 1024) break;
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
            snapshot.put("truncated", all.size() > 1024);
            return snapshot.toString();
        } catch (Exception e) {
            throw new RemoteException("Failed to read Android packages: " + e.getClass().getSimpleName());
        }
    }


    /** Source-only Shizuku diagnostics, no command arguments from the browser. */
    @Override
    public String readSystemOverview() throws RemoteException {
        try {
            int uid = authorizedUid();
            JSONObject payload = new JSONObject();
            payload.put("version", 1);
            payload.put("source", "shizuku-user-service");
            payload.put("uid", uid);
            payload.put("observedAt", java.time.Instant.now().toString());
            JSONArray processes = new JSONArray();
            boolean truncated = false;
            try {
                String raw;
                try {
                    raw = execute(262144, "/system/bin/ps", "-A", "-o", "PID,USER,RSS,%CPU,NAME");
                } catch (Exception unsupported) {
                    raw = execute(262144, "/system/bin/ps", "-A", "-o", "PID,USER,RSS,NAME");
                }
                String[] lines = raw.split("\\R");
                for (String line : lines) {
                    String[] fields = line.trim().split("\\s+", 5);
                    if (fields.length < 4 || !fields[0].matches("[0-9]+")) continue;
                    if (processes.length() >= 1200) { truncated = true; break; }
                    JSONObject entry = new JSONObject();
                    entry.put("pid", Integer.parseInt(fields[0]));
                    entry.put("user", fields[1].substring(0, Math.min(48, fields[1].length())));
                    entry.put("rssKb", fields[2].matches("[0-9]+") ? Long.parseLong(fields[2]) : JSONObject.NULL);
                    int nameIndex = fields.length >= 5 ? 4 : 3;
                    entry.put("name", fields[nameIndex].substring(0, Math.min(160, fields[nameIndex].length())));
                    Double pcpu = fields.length >= 5 ? parsePercent(fields[3]) : null;
                    entry.put("cpuPercent", pcpu == null ? JSONObject.NULL : pcpu);
                    processes.put(entry);
                }
            } catch (Exception unavailable) {
                payload.put("processError", "Android process inventory unavailable");
            }
            payload.put("processes", processes);
            payload.put("processesTruncated", truncated);

            JSONObject power = new JSONObject();
            try {
                String raw = execute(12288, "/system/bin/dumpsys", "battery");
                Integer level = extractInt(raw, "(?m)^\\s*level:\\s*(\\d+)\\s*$");
                Integer temperature = extractInt(raw, "(?m)^\\s*temperature:\\s*(\\d+)\\s*$");
                Integer plugged = extractInt(raw, "(?m)^\\s*plugged:\\s*(\\d+)\\s*$");
                power.put("batteryLevel", level == null || level > 100 ? JSONObject.NULL : level);
                power.put("batteryTemperatureC", temperature == null ? JSONObject.NULL : temperature / 10.0);
                power.put("charging", plugged == null ? JSONObject.NULL : plugged > 0);
            } catch (Exception unavailable) {
                power.put("batteryLevel", JSONObject.NULL);
                power.put("batteryTemperatureC", JSONObject.NULL);
                power.put("charging", JSONObject.NULL);
            }
            try {
                String raw = execute(8192, "/system/bin/cat", "/proc/meminfo");
                power.put("memoryTotalKb", maybeNumber(extractLong(raw, "(?m)^MemTotal:\\s*(\\d+)\\s*kB")));
                power.put("memoryAvailableKb", maybeNumber(extractLong(raw, "(?m)^MemAvailable:\\s*(\\d+)\\s*kB")));
            } catch (Exception unavailable) {
                power.put("memoryTotalKb", JSONObject.NULL);
                power.put("memoryAvailableKb", JSONObject.NULL);
            }
            payload.put("power", power);

            JSONObject settings = new JSONObject();
            try {
                String brightness = execute(64, "/system/bin/settings", "get", "system", "screen_brightness").trim();
                settings.put("brightness", brightness.matches("\\d+") ? Integer.parseInt(brightness) : JSONObject.NULL);
            } catch (Exception unavailable) {
                settings.put("brightness", JSONObject.NULL);
            }
            try {
                String airplane = execute(64, "/system/bin/settings", "get", "global", "airplane_mode_on").trim();
                settings.put("airplaneMode", ("0".equals(airplane) || "1".equals(airplane))
                        ? "1".equals(airplane) : JSONObject.NULL);
            } catch (Exception unavailable) {
                settings.put("airplaneMode", JSONObject.NULL);
            }
            payload.put("settings", settings);

            JSONObject services = new JSONObject();
            try {
                String raw = execute(700000, "/system/bin/dumpsys", "activity", "services");
                JSONArray names = new JSONArray();
                Pattern matcherPattern = Pattern.compile("ServiceRecord\\{[^}\\n]*?\\s([a-zA-Z0-9_.$]+/[a-zA-Z0-9_.$]+)(?:\\s[^}]*)?\\}");
                Matcher matcher = matcherPattern.matcher(raw);
                Set<String> seenServices = new TreeSet<>();
                while (matcher.find() && names.length() < 256) {
                    String component = matcher.group(1);
                    if (seenServices.add(component)) names.put(component);
                }
                services.put("names", names);
                services.put("truncated", names.length() >= 256);
            } catch (Exception unavailable) {
                services.put("names", new JSONArray());
                services.put("truncated", false);
                services.put("error", "Android service listing unavailable");
            }
            payload.put("services", services);
            return payload.toString();
        } catch (Exception e) {
            throw new RemoteException("System overview failed: " + e.getClass().getSimpleName());
        }
    }

    /** App details come from the actual Shizuku shell; never expose dumpsys raw text. */
    @Override
    public String inspectApp(String packageName) throws RemoteException {
        try {
            authorizedUid();
            String pkg = requirePackage(packageName);
            String raw = execute(98304, "/system/bin/dumpsys", "package", pkg);
            JSONObject result = new JSONObject();
            result.put("packageName", pkg);
            result.put("versionName", readFirst(raw, "(?m)\\bversionName=([^\\s]+)"));
            result.put("targetSdk", maybeNumber(extractLong(raw, "(?m)\\btargetSdk=(\\d+)")));
            JSONArray permissions = new JSONArray();
            Set<String> seen = new TreeSet<>();
            Pattern permissionLine = Pattern.compile("(?m)^\\s*(android\\.permission\\.[A-Z0-9_]+):\\s*granted=(true|false)");
            Matcher matcher = permissionLine.matcher(raw);
            while (matcher.find() && permissions.length() < 96) {
                if (seen.add(matcher.group(1))) {
                    JSONObject item = new JSONObject();
                    item.put("permission", matcher.group(1));
                    item.put("granted", Boolean.parseBoolean(matcher.group(2)));
                    permissions.put(item);
                }
            }
            result.put("permissions", permissions);
            return result.toString();
        } catch (Exception e) {
            throw new RemoteException("App inspection failed: " + e.getClass().getSimpleName());
        }
    }

    /**
     * Called ONLY via native owner-visible Companion Binder.
     * No method dispatch from the browser/HTTP bridge is provided.
     */
    @Override
    public String runOwnerAction(String action, String target, String value) throws RemoteException {
        try {
            int uid = authorizedUid();
            String output;
            switch (action) {
                case "launch":
                    output = execute(8192, "/system/bin/monkey", "-p",
                            requirePackage(target), "-c", "android.intent.category.LAUNCHER", "1");
                    break;
                case "force-stop":
                    output = execute(4096, "/system/bin/am", "force-stop", requirePackage(target));
                    break;
                case "uninstall":
                    output = execute(8192, "/system/bin/pm", "uninstall", "--user", "0", requirePackage(target));
                    break;
                case "grant":
                    output = execute(8192, "/system/bin/pm", "grant",
                            requirePackage(target), requirePermission(value));
                    break;
                case "revoke":
                    output = execute(8192, "/system/bin/pm", "revoke",
                            requirePackage(target), requirePermission(value));
                    break;
                case "process-stop":
                    if (target == null || !target.matches("[1-9][0-9]{1,6}"))
                        throw new IllegalArgumentException("Invalid process PID");
                    output = execute(8192, "/system/bin/kill", "-TERM", target);
                    break;
                case "service-start":
                case "service-stop":
                    String component = requireComponent(target);
                    output = execute(8192, "/system/bin/am",
                            "service-start".equals(action) ? "startservice" : "stopservice", "-n", component);
                    break;
                case "brightness":
                    if (value == null || !value.matches("[0-9]{1,3}") ||
                            Integer.parseInt(value) > 255)
                        throw new IllegalArgumentException("Brightness must be 0..255");
                    output = execute(8192, "/system/bin/settings", "put", "system",
                            "screen_brightness", value);
                    break;
                case "timeout":
                    if (value == null || !value.matches("[0-9]{4,8}") ||
                            Long.parseLong(value) < 15000L || Long.parseLong(value) > 3600000L)
                        throw new IllegalArgumentException("Screen timeout must be 15000..3600000 ms");
                    output = execute(8192, "/system/bin/settings", "put", "system",
                            "screen_off_timeout", value);
                    break;
                case "shell":
                    if (target == null || target.isBlank() || target.length() > 240)
                        throw new IllegalArgumentException("Shell command length exceeded");
                    output = execute(16384, "/system/bin/sh", "-c", target);
                    break;
                default:
                    throw new IllegalArgumentException("Unsupported operation");
            }
            if (("uninstall".equals(action) || "launch".equals(action) ||
                    "service-start".equals(action) || "service-stop".equals(action)) &&
                    (output.contains("Failure [") || output.contains("No activities found") ||
                     output.contains("Error:"))) {
                throw new IllegalStateException("Android command reported a failure");
            }
            JSONObject result = new JSONObject();
            result.put("action", action);
            result.put("target", target == null ? "" : target.substring(0, Math.min(240, target.length())));
            result.put("mode", uid == 0 ? "root" : "adb");
            result.put("success", true);
            result.put("output", output.substring(0, Math.min(4096, output.length())));
            return result.toString();
        } catch (Exception e) {
            // Shell errors and OS refusals are not successes.
            throw new RemoteException("Android refused operation: " + e.getClass().getSimpleName()
                    + ": " + String.valueOf(e.getMessage()).substring(0, Math.min(120,
                    String.valueOf(e.getMessage()).length())));
        }
    }

    private static int authorizedUid() {
        int uid = Os.getuid();
        if (uid != 2000 && uid != 0) throw new SecurityException("Expected Shizuku shell/root UID");
        return uid;
    }

    private static String requirePackage(String input) {
        if (input == null || input.length() > 200 ||
                !input.matches("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+"))
            throw new IllegalArgumentException("Invalid Android package");
        return input;
    }

    private static String requirePermission(String input) {
        if (input == null || input.length() > 180 ||
                !input.matches("android\\.permission\\.[A-Z0-9_]+"))
            throw new IllegalArgumentException("Invalid Android runtime permission");
        return input;
    }

    private static String requireComponent(String input) {
        if (input == null || input.length() > 300 ||
                !input.matches("[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+/[A-Za-z0-9_.$]+"))
            throw new IllegalArgumentException("Invalid service component");
        return input;
    }

    private static Integer extractInt(String text, String regex) {
        Long v = extractLong(text, regex);
        return v == null || v > Integer.MAX_VALUE ? null : v.intValue();
    }

    private static Long extractLong(String text, String regex) {
        Matcher match = Pattern.compile(regex).matcher(text);
        return match.find() ? Long.parseLong(match.group(1)) : null;
    }

    private static Object maybeNumber(Long number) {
        return number == null ? JSONObject.NULL : number;
    }

    private static String readFirst(String text, String regex) {
        Matcher match = Pattern.compile(regex).matcher(text);
        return match.find() ? match.group(1).substring(0, Math.min(100, match.group(1).length())) : "";
    }

    private static Double parsePercent(String raw) {
        try {
            double value = Double.parseDouble(raw.replace("%", ""));
            return Double.isFinite(value) && value >= 0 && value <= 100 ? value : null;
        } catch (NumberFormatException ignored) {
            return null;
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
