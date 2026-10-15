/* SPDX-License-Identifier: Apache-2.0
 * UI-task-only benchmark counters. Measures real LVGL refresh work during page slides.
 */
#include "spotpear.h"
#include "esp_log.h"
#include "esp_timer.h"
#include <string.h>
#include <stdlib.h>
extern bool muse_ui_spotpear_sliding(void);
static struct {
    bool on;
    uint32_t n, bytes, bands, frame_bytes, frame_bands, max_us;
    int64_t start, sum_us;
    uint32_t samples[512];
} perf;
static int compare(const void *a, const void *b)
{
    uint32_t x = *(const uint32_t *)a, y = *(const uint32_t *)b;
    return (x > y) - (x < y);
}
void spotpear_perf_begin(void)
{
    memset(&perf, 0, sizeof(perf));
    perf.on = true;
}
void spotpear_perf_flush(size_t bytes)
{
    if (perf.on) {
        perf.frame_bytes += bytes;
        perf.frame_bands++;
    }
}
void spotpear_perf_event(lv_event_t *event)
{
    if (!perf.on)
        return;
    if (lv_event_get_code(event) == LV_EVENT_REFR_START) {
        perf.start = esp_timer_get_time();
        perf.frame_bytes = 0;
        perf.frame_bands = 0;
    } else if (lv_event_get_code(event) == LV_EVENT_REFR_READY && perf.frame_bytes &&
               muse_ui_spotpear_sliding()) {
        uint32_t us = esp_timer_get_time() - perf.start;
        if (perf.n < 512)
            perf.samples[perf.n] = us;
        perf.n++;
        perf.sum_us += us;
        perf.bytes += perf.frame_bytes;
        perf.bands += perf.frame_bands;
        if (us > perf.max_us)
            perf.max_us = us;
    }
}
void spotpear_perf_end(void)
{
    perf.on = false;
    if (!perf.n) {
        ESP_LOGW("spotpear_perf", "No sliding frames captured");
        return;
    }
    unsigned count = perf.n < 512 ? perf.n : 512;
    qsort(perf.samples, count, sizeof(perf.samples[0]), compare);
    ESP_LOGI("spotpear_perf",
             "swipe frames=%lu refresh_avg=%.2fms p95=%.2fms max=%.2fms bands/frame=%.1f "
             "bytes/frame=%lu",
             (unsigned long)perf.n, (double)perf.sum_us / perf.n / 1000,
             perf.samples[(count - 1) * 95 / 100] / 1000.0, perf.max_us / 1000.0,
             (double)perf.bands / perf.n, (unsigned long)(perf.bytes / perf.n));
}

/* Read-only relay reachability check; deliberately carries no credentials. */
#include "../../muse_relay.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "freertos/task.h"
#include "lwip/netdb.h"
#include "lwip/inet.h"
#include "lwip/sockets.h"
#include <fcntl.h>
#include <errno.h>
#include <stdatomic.h>
static atomic_bool network_busy;
static void network_probe(void *arg)
{
    (void)arg;
    struct addrinfo hints = {.ai_family = AF_INET, .ai_socktype = SOCK_STREAM};
    struct addrinfo *addresses = NULL;
    int rc = getaddrinfo(MUSE_RELAY_CONNECT_HOST, "443", &hints, &addresses);
    if (!rc) {
        char ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &((struct sockaddr_in *)addresses->ai_addr)->sin_addr, ip, sizeof(ip));
        ESP_LOGI("spotpear_net", "relay target IPv4=%s", ip);
        for (struct addrinfo *address = addresses; address; address = address->ai_next) {
            int fd = socket(AF_INET, SOCK_STREAM, 0);
            if (fd < 0) break;
            fcntl(fd, F_SETFL, O_NONBLOCK);
            int connected = connect(fd, address->ai_addr, address->ai_addrlen);
            int error = connected == 0 ? 0 : errno;
            if (connected < 0 && error == EINPROGRESS) {
                fd_set writable; FD_ZERO(&writable); FD_SET(fd, &writable);
                struct timeval timeout = {.tv_sec = 5};
                int ready = select(fd + 1, NULL, &writable, NULL, &timeout);
                socklen_t length = sizeof(error);
                if (ready > 0) getsockopt(fd, SOL_SOCKET, SO_ERROR, &error, &length);
                else error = ready == 0 ? ETIMEDOUT : errno;
            }
            inet_ntop(AF_INET, &((struct sockaddr_in *)address->ai_addr)->sin_addr, ip, sizeof(ip));
            ESP_LOGI("spotpear_net", "relay TCP %s:443 error=%d", ip, error);
            close(fd);
        }
        freeaddrinfo(addresses);
        esp_http_client_config_t cfg = {
            .url = MUSE_RELAY_API "/health", .timeout_ms = 45000,
            .crt_bundle_attach = esp_crt_bundle_attach, .disable_auto_redirect = true,
            .common_name = MUSE_RELAY_HOST,
        };
        esp_http_client_handle_t client = esp_http_client_init(&cfg);
        if (client) {
            esp_http_client_set_header(client, "Host", MUSE_RELAY_HOST);
            esp_err_t err = esp_http_client_perform(client);
            ESP_LOGI("spotpear_net", "relay HTTPS health=%d result=%s",
                     esp_http_client_get_status_code(client), esp_err_to_name(err));
            esp_http_client_cleanup(client);
        } else ESP_LOGE("spotpear_net", "HTTP allocation failed");
    } else ESP_LOGE("spotpear_net", "relay DNS failed=%d", rc);
    atomic_store(&network_busy, false);
    vTaskDelete(NULL);
}
void spotpear_network_probe(void)
{
    if (atomic_exchange(&network_busy, true)) return;
    if (xTaskCreate(network_probe, "relay_probe", 6144, NULL, 3, NULL) != pdPASS) {
        atomic_store(&network_busy, false);
        ESP_LOGE("spotpear_net", "Probe task allocation failed");
    }
}
