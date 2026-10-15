/* SPDX-License-Identifier: Apache-2.0
 * ST77916 sequence: vendor Demo_Arduino's default driver, previously verified on this V1.
 * LVGL9 task/locking follows the official Muse self-driven board pattern.
 */
#include "spotpear.h"
#include "muse_mem.h"
#include "driver/i2c_master.h"
#include "driver/ledc.h"
#include "driver/spi_master.h"
#include "esp_check.h"
#include "esp_lcd_panel_io.h"
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_st77916.h"
#include "esp_lcd_custom_types.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#define DRAW_ROWS SPOTPEAR_RENDER_ROWS
#define DRAW_BYTES (SPOTPEAR_WIDTH * DRAW_ROWS * 2)
static i2c_master_dev_handle_t touch_device;
static esp_lcd_panel_handle_t panel;
static lv_display_t *display;
static lv_indev_t *pointer;
static SemaphoreHandle_t ui_lock, started;
static esp_err_t start_error;

esp_err_t spotpear_touch_init(void)
{
    gpio_config_t reset = {.pin_bit_mask = 1ULL << SPOTPEAR_TOUCH_RST, .mode = GPIO_MODE_OUTPUT};
    ESP_RETURN_ON_ERROR(gpio_config(&reset), "spotpear", "touch reset pin");
    gpio_set_level(SPOTPEAR_TOUCH_RST, 0);
    vTaskDelay(pdMS_TO_TICKS(10));
    gpio_set_level(SPOTPEAR_TOUCH_RST, 1);
    vTaskDelay(pdMS_TO_TICKS(120));
    gpio_config_t irq = {
        .pin_bit_mask = 1ULL << SPOTPEAR_TOUCH_INT, .mode = GPIO_MODE_INPUT, .pull_up_en = true};
    ESP_RETURN_ON_ERROR(gpio_config(&irq), "spotpear", "touch INT");
    i2c_master_bus_config_t bus_cfg = {.i2c_port = I2C_NUM_0,
                                       .sda_io_num = SPOTPEAR_TOUCH_SDA,
                                       .scl_io_num = SPOTPEAR_TOUCH_SCL,
                                       .clk_source = I2C_CLK_SRC_DEFAULT,
                                       .glitch_ignore_cnt = 7,
                                       .flags.enable_internal_pullup = true};
    i2c_master_bus_handle_t bus;
    ESP_RETURN_ON_ERROR(i2c_new_master_bus(&bus_cfg, &bus), "spotpear", "touch I2C");
    i2c_device_config_t dev = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7, .device_address = 0x15, .scl_speed_hz = 400000};
    ESP_RETURN_ON_ERROR(i2c_master_bus_add_device(bus, &dev, &touch_device), "spotpear",
                        "touch device");
    ESP_RETURN_ON_ERROR(i2c_master_probe(bus, 0x15, 100), "spotpear", "touch probe");
    const uint8_t awake[] = {0xfe, 1};
    return i2c_master_transmit(touch_device, awake, sizeof(awake), 100);
}
static void touch_read(lv_indev_t *indev, lv_indev_data_t *data)
{
    (void)indev;
    static lv_point_t last;
    uint8_t reg = 2, raw[5];
    data->state = LV_INDEV_STATE_RELEASED;
    if (i2c_master_transmit_receive(touch_device, &reg, 1, raw, sizeof(raw), 20) == ESP_OK) {
        unsigned x = ((raw[1] & 15) << 8) | raw[2], y = ((raw[3] & 15) << 8) | raw[4];
        if ((raw[0] & 15) > 0 && x < SPOTPEAR_WIDTH && y < SPOTPEAR_HEIGHT) {
            last.x = x;
            last.y = y;
            data->state = LV_INDEV_STATE_PRESSED;
        }
    }
    data->point = last;
}
static uint32_t tick_ms(void)
{
    return (uint32_t)(esp_timer_get_time() / 1000);
}
static esp_err_t start_display(void)
{
    ledc_timer_config_t timer = {.speed_mode = LEDC_LOW_SPEED_MODE,
                                 .duty_resolution = LEDC_TIMER_13_BIT,
                                 .timer_num = LEDC_TIMER_0,
                                 .freq_hz = 5000,
                                 .clk_cfg = LEDC_AUTO_CLK};
    ESP_RETURN_ON_ERROR(ledc_timer_config(&timer), "spotpear", "backlight timer");
    ledc_channel_config_t channel = {.gpio_num = SPOTPEAR_LCD_BL,
                                     .speed_mode = LEDC_LOW_SPEED_MODE,
                                     .channel = LEDC_CHANNEL_0,
                                     .timer_sel = LEDC_TIMER_0,
                                     .duty = 0};
    ESP_RETURN_ON_ERROR(ledc_channel_config(&channel), "spotpear", "backlight PWM");
    lv_init();
    lv_tick_set_cb(tick_ms);
    display = lv_display_create(SPOTPEAR_WIDTH, SPOTPEAR_HEIGHT);
    ESP_RETURN_ON_FALSE(display, ESP_ERR_NO_MEM, "spotpear", "LVGL display");
    void *buffer1 = heap_caps_malloc(DRAW_BYTES, MUSE_BIG_CAPS);
    void *buffer2 = heap_caps_malloc(DRAW_BYTES, MUSE_BIG_CAPS);
    ESP_RETURN_ON_FALSE(buffer1 && buffer2, ESP_ERR_NO_MEM, "spotpear", "draw buffers");
    lv_display_set_color_format(display, LV_COLOR_FORMAT_RGB565_SWAPPED);
    lv_display_set_buffers(display, buffer1, buffer2, DRAW_BYTES, LV_DISPLAY_RENDER_MODE_PARTIAL);
    lv_display_set_flush_cb(display, spotpear_transport_flush);
    lv_display_add_event_cb(display, spotpear_perf_event, LV_EVENT_REFR_START, NULL);
    lv_display_add_event_cb(display, spotpear_perf_event, LV_EVENT_REFR_READY, NULL);
    spi_bus_config_t bus =
        ST77916_PANEL_BUS_QSPI_CONFIG(SPOTPEAR_LCD_CLK, SPOTPEAR_LCD_D0, SPOTPEAR_LCD_D1,
                                      SPOTPEAR_LCD_D2, SPOTPEAR_LCD_D3, SPOTPEAR_DMA_BYTES);
    ESP_RETURN_ON_ERROR(spi_bus_initialize(SPI2_HOST, &bus, SPI_DMA_CH_AUTO), "spotpear", "QSPI");
    esp_lcd_panel_io_spi_config_t io_cfg =
        ST77916_PANEL_IO_QSPI_CONFIG(SPOTPEAR_LCD_CS, NULL, NULL);
    esp_lcd_panel_io_handle_t io;
    ESP_RETURN_ON_ERROR(esp_lcd_new_panel_io_spi(SPI2_HOST, &io_cfg, &io), "spotpear", "LCD IO");
    esp_lcd_panel_vendor_config_t vendor = {.flags.use_qspi_interface = true};
    esp_lcd_panel_dev_config_t config = {.reset_gpio_num = SPOTPEAR_LCD_RST,
                                         .rgb_ele_order = LCD_RGB_ELEMENT_ORDER_RGB,
                                         .bits_per_pixel = 16,
                                         .vendor_config = &vendor};
    ESP_RETURN_ON_ERROR(esp_lcd_new_panel_st77916(io, &config, &panel), "spotpear", "ST77916");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_reset(panel), "spotpear", "LCD reset");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_init(panel), "spotpear", "LCD init");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_invert_color(panel, true), "spotpear", "LCD invert");
    ESP_RETURN_ON_ERROR(esp_lcd_panel_disp_on_off(panel, true), "spotpear", "LCD on");
    ESP_RETURN_ON_ERROR(spotpear_transport_start(panel, io, display), "spotpear", "LCD transport");
    pointer = lv_indev_create();
    ESP_RETURN_ON_FALSE(pointer, ESP_ERR_NO_MEM, "spotpear", "LVGL touch");
    lv_indev_set_type(pointer, LV_INDEV_TYPE_POINTER);
    lv_indev_set_display(pointer, display);
    lv_indev_set_read_cb(pointer, touch_read);
    lv_timer_set_period(lv_indev_get_read_timer(pointer), 10);
    ESP_LOGI("spotpear", "ST77916/CST816S ready, 360x360 QSPI, LVGL9");
    return ESP_OK;
}
static void display_task(void *arg)
{
    (void)arg;
    start_error = start_display();
    xSemaphoreGive(started);
    if (start_error != ESP_OK) {
        vTaskDelete(NULL);
        return;
    }
    for (;;) {
        xSemaphoreTakeRecursive(ui_lock, portMAX_DELAY);
        uint32_t delay = lv_timer_handler();
        xSemaphoreGiveRecursive(ui_lock);
        if (delay < 5)
            delay = 5;
        if (delay > 50)
            delay = 50;
        vTaskDelay(pdMS_TO_TICKS(delay));
    }
}
lv_display_t *spotpear_display_start(lv_indev_t **touch)
{
    *touch = NULL;
    ui_lock = xSemaphoreCreateRecursiveMutex();
    started = xSemaphoreCreateBinary();
    if (!ui_lock || !started)
        return NULL;
    if (xTaskCreatePinnedToCore(display_task, "spotpear_ui", 8192, NULL, MUSE_UI_PRIORITY, NULL,
                                MUSE_UI_CORE) != pdPASS)
        return NULL;
    xSemaphoreTake(started, portMAX_DELAY);
    if (start_error != ESP_OK)
        return NULL;
    *touch = pointer;
    return display;
}
bool spotpear_display_lock(int timeout_ms)
{
    return xSemaphoreTakeRecursive(ui_lock, timeout_ms < 0 ? portMAX_DELAY
                                                           : pdMS_TO_TICKS(timeout_ms)) == pdTRUE;
}
void spotpear_display_unlock(void)
{
    xSemaphoreGiveRecursive(ui_lock);
}
void spotpear_brightness(int percent)
{
    if (percent < 0)
        percent = 0;
    if (percent > 100)
        percent = 100;
    ledc_set_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, percent * 8191 / 100);
    ledc_update_duty(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0);
}
