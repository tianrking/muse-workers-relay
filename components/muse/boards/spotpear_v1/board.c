/* SPDX-License-Identifier: Apache-2.0 */
#include "spotpear.h"
#include "esp_log.h"
#include "esp_check.h"
static muse_gpio_button_t talk_button;
static esp_err_t board_init(void)
{
    ESP_RETURN_ON_ERROR(muse_gpio_button_init(&talk_button, SPOTPEAR_BOOT), "spotpear", "BOOT");
    talk_button.pressed = gpio_get_level(SPOTPEAR_BOOT) == 0;
    ESP_RETURN_ON_ERROR(spotpear_touch_init(), "spotpear", "CST816S");
    esp_err_t sd = spotpear_storage_mount();
    if (sd != ESP_OK)
        ESP_LOGW("spotpear", "SD card unavailable: %s; continuing", esp_err_to_name(sd));
    return ESP_OK;
}
static unsigned poll_buttons(void)
{
    return muse_gpio_button_poll(&talk_button);
}
static const muse_board_t board = {
    .name = "Spotpear ESP32-S3 Round 1.8 V1",
    .width = SPOTPEAR_WIDTH,
    .height = SPOTPEAR_HEIGHT,
    .round = true,
    .touch = true,
    .touch_talk = true,
    .diagonal_in = 1.8f,
    .talk_button = "boot",
    .talk_hint = {LV_ALIGN_BOTTOM_MID, 0, -34},
    .frame_ms = 40,
    .init = board_init,
    .display_start = spotpear_display_start,
    .display_lock = spotpear_display_lock,
    .display_unlock = spotpear_display_unlock,
    .set_brightness = spotpear_brightness,
    .audio_init = spotpear_audio_init,
    .mic_slot = 0,
    .set_mic_gain = spotpear_mic_gain,
    .audio_power = spotpear_audio_power,
    .poll_buttons = poll_buttons,
    /* USB/Qi mains power: no battery gauge, PMIC, or verified software power-off. */
};
const muse_board_t *muse_board_get(void)
{
    return &board;
}
