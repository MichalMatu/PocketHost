package pl.pockethost.companion;

import android.content.Context;
import android.util.Log;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Loopback-only telemetry and a code-protected request inbox. No HTTP handler executes shell commands. */
public final class TelemetryHttpServer {
    public static final int PORT = 18791;
    private static final String TAG = "PocketHostTelemetry";
    private static volatile boolean running;

    private TelemetryHttpServer() {}

    public static synchronized void start(Context context) {
        if (running) return;
        Context app = context.getApplicationContext();
        try {
            ServerSocket listener = new ServerSocket();
            // Bind to loopback only; never a wildcard, phone Wi-Fi or WAN address.
            listener.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), PORT));
            running = true;
            Thread worker = new Thread(() -> serve(app, listener), "pockethost-telemetry-local");
            worker.setDaemon(true);
            worker.start();
        } catch (Exception error) {
            Log.w(TAG, "Read-only localhost bridge unavailable: " + error.getClass().getSimpleName());
        }
    }


    private static String readLine(InputStream input, int limit) throws java.io.IOException {
        ByteArrayOutputStream line = new ByteArrayOutputStream();
        int value;
        while ((value = input.read()) != -1) {
            if (value == '\n') break;
            if (line.size() >= limit) throw new java.io.IOException("HTTP line too long");
            line.write(value);
        }
        if (value == -1 && line.size() == 0) return null;
        byte[] bytes = line.toByteArray();
        int length = bytes.length;
        if (length > 0 && bytes[length - 1] == '\r') length--;
        return new String(bytes, 0, length, StandardCharsets.US_ASCII);
    }

    private static void serve(Context context, ServerSocket listener) {
        try {
            while (!listener.isClosed()) {
                try (Socket client = listener.accept()) {
                    client.setSoTimeout(2500);
                    InputStream input = new BufferedInputStream(client.getInputStream());
                    String request = readLine(input, 512);
                    if (request == null) continue;
                    OutputStream output = client.getOutputStream();
                    boolean statusRoute = request.matches("GET /status HTTP/1\\.[01]");
                    boolean appsRoute = request.matches("GET /apps HTTP/1\\.[01]");
                    boolean systemRoute = request.matches("GET /system HTTP/1\\.[01]");
                    Matcher detailRequest = Pattern.compile(
                            "GET /app\\?package=([A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+) HTTP/1\\.[01]")
                            .matcher(request);
                    boolean appDetailRoute = detailRequest.matches();
                    boolean submitRoute = request.matches("POST /shell/submit HTTP/1\\.[01]");
                    boolean pollRoute = request.matches("POST /shell/poll HTTP/1\\.[01]");
                    int length = -1;
                    boolean json = false;
                    boolean invalid = false;
                    boolean ended = false;
                    for (int n = 0; n < 24; n++) {
                        String header = readLine(input, 1024);
                        if (header == null) { invalid = true; break; }
                        if (header.isEmpty()) { ended = true; break; }
                        int colon = header.indexOf(':');
                        if (colon < 1) { invalid = true; break; }
                        String key = header.substring(0, colon).trim().toLowerCase(java.util.Locale.ROOT);
                        String value = header.substring(colon + 1).trim();
                        if ("content-length".equals(key)) {
                            if (length != -1 || !value.matches("[0-9]{1,4}")) invalid = true;
                            else length = Integer.parseInt(value);
                        }
                        if ("content-type".equals(key)) {
                            if (!value.equalsIgnoreCase("application/json")) invalid = true;
                            json = true;
                        }
                        if ("transfer-encoding".equals(key)) invalid = true;
                    }
                    String body;
                    int status;
                    if (invalid || !ended) {
                        body = "{\"error\":\"invalid-request\"}";
                        status = 400;
                    } else if (submitRoute || pollRoute) {
                        if (!json || length < 2 || length > 2048) {
                            body = "{\"error\":\"invalid-request\"}";
                            status = 400;
                        } else {
                            byte[] bytes = input.readNBytes(length);
                            if (bytes.length != length) {
                                body = "{\"error\":\"invalid-request\"}";
                                status = 400;
                            } else {
                                RemoteShellInbox.Reply response = RemoteShellInbox.handle(
                                        submitRoute ? "submit" : "poll",
                                        new String(bytes, StandardCharsets.UTF_8));
                                body = response.body;
                                status = response.status;
                            }
                        }
                    } else if (!statusRoute && !appsRoute && !systemRoute && !appDetailRoute) {
                        body = "{\"error\":\"not-found\"}";
                        status = 404;
                    } else {
                        try {
                            body = (appDetailRoute ? TelemetryProvider.app(context, detailRequest.group(1)) :
                                    appsRoute ? TelemetryProvider.apps(context) :
                                    systemRoute ? TelemetryProvider.system(context) :
                                    TelemetryProvider.status(context)).toString();
                            status = 200;
                        } catch (Exception e) {
                            body = "{\"error\":\"telemetry-unavailable\"}";
                            status = 503;
                        }
                    }
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    String headers = "HTTP/1.1 " + status + (status == 200 || status == 202 ? " OK" : " Error") +
                            "\r\nContent-Type: application/json; charset=utf-8" +
                            "\r\nCache-Control: no-store" +
                            "\r\nX-Content-Type-Options: nosniff" +
                            "\r\nReferrer-Policy: no-referrer" +
                            "\r\nConnection: close\r\nContent-Length: " + bytes.length + "\r\n\r\n";
                    output.write(headers.getBytes(StandardCharsets.US_ASCII));
                    output.write(bytes);
                    output.flush();
                } catch (Exception ignored) {
                    // Malformed loopback requests cannot take down the companion.
                }
            }
        } catch (Exception error) {
            Log.w(TAG, "Companion localhost listener stopped: " + error.getClass().getSimpleName());
        } finally {
            try { listener.close(); } catch (Exception ignored) {}
            running = false;
        }
    }
}
