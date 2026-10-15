/* SPDX-License-Identifier: Apache-2.0
 * Tall PSRAM render bands, streamed through two small internal DMA buffers.
 * Pattern follows Meta's muse_lcd_bands.c, without requiring its BSP adapter.
 * A band stays owned by LVGL until the last DMA completion, including errors.
 */
#include "spotpear.h"
#include "muse_mem.h"
#include "esp_check.h"
#include "esp_lcd_panel_ops.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include <string.h>
typedef struct {
    const uint8_t *pixels;
    int x1, y1, x2, y2;
} band_t;
static QueueHandle_t bands;
static SemaphoreHandle_t chunk_free;
static uint8_t *chunk[2];
static esp_lcd_panel_handle_t panel;
static lv_display_t *display;
static portMUX_TYPE state_lock = portMUX_INITIALIZER_UNLOCKED;
static unsigned chunks_pending;
static bool chunk_done(void)
{
    portENTER_CRITICAL_SAFE(&state_lock);
    bool last = chunks_pending > 0 && --chunks_pending == 0;
    portEXIT_CRITICAL_SAFE(&state_lock);
    return last;
}
static bool transfer_done(esp_lcd_panel_io_handle_t io, esp_lcd_panel_io_event_data_t *event,
                          void *context)
{
    (void)io;
    (void)event;
    (void)context;
    BaseType_t woken = pdFALSE;
    xSemaphoreGiveFromISR(chunk_free, &woken);
    if (chunk_done())
        lv_display_flush_ready(display);
    return woken == pdTRUE;
}
static void transmit(void *arg)
{
    (void)arg;
    band_t band;
    unsigned next = 0;
    for (;;) {
        xQueueReceive(bands, &band, portMAX_DELAY);
        size_t stride = (size_t)(band.x2 - band.x1) * 2;
        unsigned rows = SPOTPEAR_DMA_BYTES / stride;
        portENTER_CRITICAL(&state_lock);
        chunks_pending = (band.y2 - band.y1 + rows - 1) / rows;
        portEXIT_CRITICAL(&state_lock);
        for (int y = band.y1; y < band.y2; y += rows) {
            int height = band.y2 - y < (int)rows ? band.y2 - y : (int)rows;
            xSemaphoreTake(chunk_free, portMAX_DELAY);
            memcpy(chunk[next], band.pixels + (size_t)(y - band.y1) * stride, height * stride);
            esp_err_t err =
                esp_lcd_panel_draw_bitmap(panel, band.x1, y, band.x2, y + height, chunk[next]);
            if (err != ESP_OK) {
                ESP_LOGE("spotpear", "DMA chunk: %s", esp_err_to_name(err));
                xSemaphoreGive(chunk_free);
                if (chunk_done())
                    lv_display_flush_ready(display);
            } else {
                next ^= 1;
            }
        }
    }
}
esp_err_t spotpear_transport_start(esp_lcd_panel_handle_t lcd, esp_lcd_panel_io_handle_t io,
                                   lv_display_t *disp)
{
    panel = lcd;
    display = disp;
    bands = xQueueCreate(2, sizeof(band_t));
    chunk_free = xSemaphoreCreateCounting(2, 2);
    for (unsigned i = 0; i < 2; i++)
        chunk[i] = heap_caps_malloc(SPOTPEAR_DMA_BYTES, MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL);
    ESP_RETURN_ON_FALSE(bands && chunk_free && chunk[0] && chunk[1], ESP_ERR_NO_MEM, "spotpear",
                        "LCD transport buffers");
    const esp_lcd_panel_io_callbacks_t callbacks = {.on_color_trans_done = transfer_done};
    ESP_RETURN_ON_ERROR(esp_lcd_panel_io_register_event_callbacks(io, &callbacks, NULL), "spotpear",
                        "DMA callback");
    ESP_RETURN_ON_FALSE(xTaskCreatePinnedToCore(transmit, "lcd_send", 3072, NULL,
                                                MUSE_UI_PRIORITY + 1, NULL, MUSE_UI_CORE) == pdPASS,
                        ESP_ERR_NO_MEM, "spotpear", "LCD send task");
    return ESP_OK;
}
void spotpear_transport_flush(lv_display_t *disp, const lv_area_t *area, uint8_t *pixels)
{
    band_t band = {pixels, area->x1, area->y1, area->x2 + 1, area->y2 + 1};
    spotpear_perf_flush((size_t)(band.x2 - band.x1) * (band.y2 - band.y1) * 2);
    if (xQueueSend(bands, &band, 0) != pdTRUE) {
        ESP_LOGE("spotpear", "LCD queue invariant violated");
        lv_display_flush_ready(disp);
    }
}
