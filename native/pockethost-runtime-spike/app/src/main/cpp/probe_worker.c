/*
 * PocketHost S1: a disposable Android/Bionic ARM64 executable.
 * Demonstrates process execution from this APK's nativeLibraryDir.
 * This is NOT Node.js, Termux or a full host-runtime proof.
 */
#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

int main(int argc, char **argv) {
    if (argc != 2 ||
        (strcmp(argv[1], "one") && strcmp(argv[1], "two") &&
         strcmp(argv[1], "replacement"))) {
        return 2;
    }

    signal(SIGPIPE, SIG_IGN);
    int listener = socket(AF_INET, SOCK_STREAM, 0);
    if (listener < 0) return 3;

    struct sockaddr_in bind_to = {
        .sin_family = AF_INET,
        .sin_port = htons(0),
    };
    bind_to.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (bind(listener, (struct sockaddr *)&bind_to, sizeof(bind_to)) != 0 ||
        listen(listener, 2) != 0) {
        close(listener);
        return 4;
    }

    struct sockaddr_in actual = {0};
    socklen_t actual_len = sizeof(actual);
    if (getsockname(listener, (struct sockaddr *)&actual, &actual_len) != 0) {
        close(listener);
        return 5;
    }
    long pid = (long)getpid();
    unsigned int port = (unsigned int)ntohs(actual.sin_port);
    printf("{\"id\":\"%s\",\"pid\":%ld,\"port\":%u}\n", argv[1], pid, port);
    fflush(stdout);

    for (;;) {
        int client = accept(listener, NULL, NULL);
        if (client < 0) {
            if (errno == EINTR) continue;
            break;
        }
        struct timeval timeout = { .tv_sec = 2, .tv_usec = 0 };
        setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
        char request[128] = {0};
        ssize_t count = recv(client, request, sizeof(request) - 1, 0);
        if (count > 0 && strncmp(request, "GET /health ", 12) == 0) {
            char body[160], response[450];
            int nbody = snprintf(body, sizeof(body),
                                 "{\"id\":\"%s\",\"pid\":%ld}", argv[1], pid);
            if (nbody > 0 && nbody < (int)sizeof(body)) {
                int nresp = snprintf(response, sizeof(response),
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n"
                    "Cache-Control: no-store\r\nConnection: close\r\n"
                    "Content-Length: %d\r\n\r\n%s", nbody, body);
                if (nresp > 0 && nresp < (int)sizeof(response))
                    send(client, response, (size_t)nresp, MSG_NOSIGNAL);
            }
        }
        close(client);
    }
    close(listener);
    return 0;
}
