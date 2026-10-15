/* SPDX-License-Identifier: Apache-2.0
 * Spotpear V1 routes verified against vendor Arduino code, schematics and COM3 bring-up.
 * Hardware: ESP32-S3, 16MB flash / 8MB Octal PSRAM, ST77916 + CST816S,
 * PCM5100A DAC and MSM261S4030H0R microphone on separate I2S controllers.
 */
#pragma once
#include "muse_board.h"
#include "esp_lcd_panel_io.h"
#define SPOTPEAR_RENDER_ROWS 360
#define SPOTPEAR_DMA_BYTES (360 * 24 * 2)
#define SPOTPEAR_WIDTH 360
#define SPOTPEAR_HEIGHT 360
#define SPOTPEAR_LCD_CLK 9
#define SPOTPEAR_LCD_CS 10
#define SPOTPEAR_LCD_D0 11
#define SPOTPEAR_LCD_D1 12
#define SPOTPEAR_LCD_D2 13
#define SPOTPEAR_LCD_D3 14
#define SPOTPEAR_LCD_RST 47
#define SPOTPEAR_LCD_BL 15
#define SPOTPEAR_TOUCH_SDA 7
#define SPOTPEAR_TOUCH_SCL 8
#define SPOTPEAR_TOUCH_RST 40
#define SPOTPEAR_TOUCH_INT 41
#define SPOTPEAR_DAC_BCLK 18
#define SPOTPEAR_DAC_WS 16
#define SPOTPEAR_DAC_DATA 17
#define SPOTPEAR_DAC_MUTE 48
#define SPOTPEAR_MIC_BCLK 42
#define SPOTPEAR_MIC_WS 45
#define SPOTPEAR_MIC_DATA 46
#define SPOTPEAR_BOOT 0
esp_err_t spotpear_touch_init(void);
lv_display_t *spotpear_display_start(lv_indev_t **touch);
bool spotpear_display_lock(int timeout_ms);
void spotpear_display_unlock(void);
void spotpear_brightness(int percent);
esp_err_t spotpear_audio_init(esp_codec_dev_handle_t *speaker, esp_codec_dev_handle_t *microphone);
void spotpear_mic_gain(esp_codec_dev_handle_t microphone, int db);
void spotpear_audio_power(bool on);
esp_err_t spotpear_storage_mount(void);

void spotpear_perf_begin(void);
void spotpear_perf_end(void);
void spotpear_perf_flush(size_t bytes);
void spotpear_perf_event(lv_event_t *event);
void muse_ui_spotpear_benchmark(void);

esp_err_t spotpear_transport_start(esp_lcd_panel_handle_t panel, esp_lcd_panel_io_handle_t io,
                                   lv_display_t *display);
void spotpear_transport_flush(lv_display_t *disp, const lv_area_t *area, uint8_t *pixels);
