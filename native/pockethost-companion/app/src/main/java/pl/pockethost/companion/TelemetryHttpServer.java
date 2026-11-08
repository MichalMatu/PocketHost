package pl.pockethost.companion;

import android.content.Context;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Loopback-only read-only CPU and package inventory; never hosts privileged operations. */
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

    private static void serve(Context context, ServerSocket listener) {
        try {
            while (!listener.isClosed()) {
                try (Socket client = listener.accept()) {
                    client.setSoTimeout(2000);
                    BufferedReader input = new BufferedReader(
                        new InputStreamReader(client.getInputStream(), StandardCharsets.US_ASCII));
                    String request = input.readLine();
                    if (request == null || request.length() > 256) continue;
                    OutputStream output = client.getOutputStream();
                    boolean statusRoute = request.matches("GET /status HTTP/1\\.[01]");
                    boolean appsRoute = request.matches("GET /apps HTTP/1\\.[01]");
                    boolean systemRoute = request.matches("GET /system HTTP/1\\.[01]");
                    Matcher detailRequest = Pattern.compile(
                            "GET /app\\?package=([A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)+) HTTP/1\\.[01]")
                            .matcher(request);
                    boolean appDetailRoute = detailRequest.matches();
                    String body;
                    int status;
                    if (!statusRoute && !appsRoute && !systemRoute && !appDetailRoute) {
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
                    String headers = "HTTP/1.1 " + status + (status == 200 ? " OK" : " Error") +
                            "\r\nContent-Type: application/json; charset=utf-8" +
                            "\r\nCache-Control: no-store" +
                            "\r\nX-Content-Type-Options: nosniff" +
                            "\r\nConnection: close\r\nContent-Length: " + bytes.length + "\r\n\r\n";
                    output.write(headers.getBytes(StandardCharsets.US_ASCII));
                    output.write(bytes);
                    output.flush();
                } catch (Exception ignored) {
                    // Malformed local requests cannot take down the companion.
                }
            }
        } catch (Exception error) {
            Log.w(TAG, "Read-only telemetry listener stopped: " + error.getClass().getSimpleName());
        } finally {
            try { listener.close(); } catch (Exception ignored) {}
            running = false;
        }
    }
}
