package pl.pockethost.companion;

import android.os.SystemClock;
import java.security.SecureRandom;
import org.json.JSONObject;

/**
 * Ephemeral, phone-armed inbox for browser-originated shell requests.
 * This class NEVER executes a command. Only the visible MainActivity can
 * approve an exact pending request through the already-authorized Shizuku Binder.
 */
public final class RemoteShellInbox {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long ARM_MS = 10 * 60 * 1000L;
    private static final long REQUEST_MS = 90 * 1000L;
    private static long armedUntil;
    private static long lastSubmittedAt;
    private static int failedCodes;
    private static String accessCode;
    private static Pending current;

    public static final class Pending {
        public final String id;
        public final String command;
        private final long expiresAt;
        private String state = "pending";
        private String result = "";

        private Pending(String id, String command, long expiresAt) {
            this.id = id;
            this.command = command;
            this.expiresAt = expiresAt;
        }
    }

    public static final class Reply {
        public final int status;
        public final String body;
        private Reply(int status, String body) { this.status = status; this.body = body; }
    }

    private RemoteShellInbox() {}

    private static String randomHex() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        StringBuilder hex = new StringBuilder(32);
        for (byte value : bytes) hex.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
        return hex.toString();
    }

    public static synchronized String arm() {
        accessCode = String.format(java.util.Locale.ROOT, "%010d",
                (RANDOM.nextLong() & Long.MAX_VALUE) % 10000000000L);
        armedUntil = SystemClock.elapsedRealtime() + ARM_MS;
        failedCodes = 0;
        lastSubmittedAt = 0;
        current = null;
        return accessCode;
    }

    public static synchronized void disarm() {
        accessCode = null;
        armedUntil = 0;
        current = null;
    }

    private static boolean armed() {
        if (accessCode == null || SystemClock.elapsedRealtime() >= armedUntil) {
            disarm();
            return false;
        }
        return true;
    }

    public static synchronized Pending pendingForReview() {
        if (!armed() || current == null || !"pending".equals(current.state)) return null;
        if (SystemClock.elapsedRealtime() > current.expiresAt) {
            current.state = "expired";
            return null;
        }
        return current;
    }

    public static synchronized boolean begin(String id) {
        Pending item = pendingForReview();
        if (item == null || !item.id.equals(id)) return false;
        item.state = "running";
        return true;
    }

    public static synchronized void complete(String id, String state, String result) {
        if (current != null && current.id.equals(id) && "running".equals(current.state)) {
            current.state = "done".equals(state) ? "done" : "failed";
            current.result = result == null ? "" : result.substring(0, Math.min(6000, result.length()));
        }
    }

    public static synchronized void deny(String id) {
        if (current != null && current.id.equals(id) && "pending".equals(current.state)) {
            current.state = "denied";
        }
    }

    private static Reply response(int status, JSONObject body) {
        return new Reply(status, body.toString());
    }

    private static Reply error(int status, String message) {
        JSONObject body = new JSONObject();
        try { body.put("error", message); }
        catch (Exception ignored) {}
        return response(status, body);
    }

    private static boolean verifyCode(String provided) {
        if (!armed()) return false;
        if (provided != null && accessCode.equals(provided)) return true;
        failedCodes++;
        if (failedCodes >= 5) disarm(); // Fail closed on online guessing.
        return false;
    }

    public static synchronized Reply handle(String action, String raw) {
        try {
            if (raw == null || raw.length() > 2400) return error(400, "invalid-request");
            JSONObject input = new JSONObject(raw);
            if (input.length() != 2 || !input.has("code")) return error(400, "invalid-fields");
            if (!verifyCode(input.optString("code", null))) return error(403, "not-armed-or-unpaired");

            if ("submit".equals(action)) {
                if (!input.has("command")) return error(400, "missing-command");
                String command = input.optString("command", "");
                if (command.isBlank() || command.length() > 240 ||
                        command.indexOf((char) 0) >= 0) return error(400, "invalid-command");
                long now = SystemClock.elapsedRealtime();
                if (now - lastSubmittedAt < 3000L) return error(429, "slow-down");
                if (current != null && ("pending".equals(current.state) ||
                        "running".equals(current.state))) {
                    if ("running".equals(current.state) || now < current.expiresAt)
                        return error(409, "request-already-pending");
                    current.state = "expired";
                }
                current = new Pending(randomHex(), command, now + REQUEST_MS);
                lastSubmittedAt = now;
                JSONObject body = new JSONObject();
                body.put("id", current.id);
                body.put("state", "pending");
                return response(202, body);
            }

            if ("poll".equals(action)) {
                if (!input.has("id")) return error(400, "missing-id");
                String id = input.optString("id", "");
                if (current == null || !current.id.equals(id)) return error(404, "unknown-request");
                if ("pending".equals(current.state) &&
                        SystemClock.elapsedRealtime() > current.expiresAt) current.state = "expired";
                JSONObject body = new JSONObject();
                body.put("id", current.id);
                body.put("state", current.state);
                if ("done".equals(current.state) || "failed".equals(current.state))
                    body.put("result", current.result);
                return response(200, body);
            }
            return error(404, "unknown-action");
        } catch (Exception error) {
            return error(400, "malformed-request");
        }
    }
}
