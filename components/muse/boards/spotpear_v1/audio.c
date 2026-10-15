/* SPDX-License-Identifier: Apache-2.0
 * Bridge the board's two independent I2S ports to Muse's stereo PCM16 codec API.
 * PCM5100A has no I2C controls: esp_codec_dev supplies software speaker volume.
 * V1 MSM261S4030H0R is a left-slot I2S microphone with 24 significant bits.
 */
#include "spotpear.h"
#include "muse_audio.h"
#include "driver/i2s_std.h"
#include "esp_check.h"
#include <math.h>
#include <stdatomic.h>
#define AUDIO_CHUNK 320
static i2s_chan_handle_t tx, rx;
static bool tx_on, rx_on;
static _Atomic int mic_gain_q8 = 256;
static int32_t mic_dc_q8;
void spotpear_audio_power(bool on)
{
    gpio_set_level(SPOTPEAR_DAC_MUTE, on);
}
static int speaker_enable(const audio_codec_data_if_t *interface, esp_codec_dev_type_t type,
                          bool on)
{
    (void)interface;
    (void)type;
    if (on == tx_on)
        return ESP_CODEC_DEV_OK;
    if (!on)
        spotpear_audio_power(false);
    esp_err_t err = on ? i2s_channel_enable(tx) : i2s_channel_disable(tx);
    if (err != ESP_OK)
        return ESP_CODEC_DEV_DRV_ERR;
    tx_on = on;
    if (on)
        spotpear_audio_power(true);
    return ESP_CODEC_DEV_OK;
}
static int microphone_enable(const audio_codec_data_if_t *interface, esp_codec_dev_type_t type,
                             bool on)
{
    (void)interface;
    (void)type;
    if (on == rx_on)
        return ESP_CODEC_DEV_OK;
    esp_err_t err = on ? i2s_channel_enable(rx) : i2s_channel_disable(rx);
    if (err != ESP_OK)
        return ESP_CODEC_DEV_DRV_ERR;
    rx_on = on;
    if (on)
        mic_dc_q8 = 0;
    return ESP_CODEC_DEV_OK;
}
static int speaker_write(const audio_codec_data_if_t *interface, uint8_t *data, int size)
{
    (void)interface;
    if (!data || size < 0 || size % 4)
        return ESP_CODEC_DEV_INVALID_ARG;
    size_t written = 0;
    esp_err_t err = i2s_channel_write(tx, data, size, &written, 1000);
    return err == ESP_OK && written == (size_t)size ? ESP_CODEC_DEV_OK : ESP_CODEC_DEV_WRITE_FAIL;
}
static int microphone_read(const audio_codec_data_if_t *interface, uint8_t *data, int size)
{
    (void)interface;
    if (!data || size < 0 || size % 4)
        return ESP_CODEC_DEV_INVALID_ARG;
    int16_t *output = (int16_t *)data;
    size_t frames = (size_t)size / 4;
    int32_t raw[AUDIO_CHUNK * 2];
    while (frames) {
        size_t n = frames > AUDIO_CHUNK ? AUDIO_CHUNK : frames, received = 0;
        esp_err_t err = i2s_channel_read(rx, raw, n * 2 * sizeof(raw[0]), &received, 1000);
        if (err != ESP_OK || received != n * 2 * sizeof(raw[0]))
            return ESP_CODEC_DEV_READ_FAIL;
        int gain = atomic_load(&mic_gain_q8);
        for (size_t i = 0; i < n; i++) {
            int32_t sample = raw[2 * i] >> 16;
            mic_dc_q8 += (sample * 256 - mic_dc_q8) >> 8;
            int32_t scaled = (sample - (mic_dc_q8 >> 8)) * gain / 256;
            int16_t pcm = scaled > INT16_MAX ? INT16_MAX : scaled < INT16_MIN ? INT16_MIN : scaled;
            // Muse selects slot zero; duplicate to keep codec self-tests meaningful.
            output[2 * i] = output[2 * i + 1] = pcm;
        }
        output += n * 2;
        frames -= n;
    }
    return ESP_CODEC_DEV_OK;
}
void spotpear_mic_gain(esp_codec_dev_handle_t microphone, int db)
{
    (void)microphone;
    if (db < 0)
        db = 0;
    if (db > 36)
        db = 36;
    atomic_store(&mic_gain_q8, (int)lroundf(256.0f * powf(10.0f, db / 20.0f)));
}
esp_err_t spotpear_audio_init(esp_codec_dev_handle_t *speaker, esp_codec_dev_handle_t *microphone)
{
    gpio_config_t mute = {.pin_bit_mask = 1ULL << SPOTPEAR_DAC_MUTE, .mode = GPIO_MODE_OUTPUT};
    ESP_RETURN_ON_ERROR(gpio_config(&mute), "spotpear", "DAC mute pin");
    spotpear_audio_power(false);
    i2s_chan_config_t out = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    out.auto_clear = true;
    ESP_RETURN_ON_ERROR(i2s_new_channel(&out, &tx, NULL), "spotpear", "DAC I2S0");
    i2s_std_config_t dac = {.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(MUSE_AUDIO_RATE),
                            .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
                                I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO),
                            .gpio_cfg = {.mclk = I2S_GPIO_UNUSED,
                                         .bclk = SPOTPEAR_DAC_BCLK,
                                         .ws = SPOTPEAR_DAC_WS,
                                         .dout = SPOTPEAR_DAC_DATA,
                                         .din = I2S_GPIO_UNUSED}};
    ESP_RETURN_ON_ERROR(i2s_channel_init_std_mode(tx, &dac), "spotpear", "PCM5100A");
    i2s_chan_config_t in = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_1, I2S_ROLE_MASTER);
    ESP_RETURN_ON_ERROR(i2s_new_channel(&in, NULL, &rx), "spotpear", "microphone I2S1");
    i2s_std_config_t mic = {.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(MUSE_AUDIO_RATE),
                            .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
                                I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO),
                            .gpio_cfg = {.mclk = I2S_GPIO_UNUSED,
                                         .bclk = SPOTPEAR_MIC_BCLK,
                                         .ws = SPOTPEAR_MIC_WS,
                                         .dout = I2S_GPIO_UNUSED,
                                         .din = SPOTPEAR_MIC_DATA}};
    ESP_RETURN_ON_ERROR(i2s_channel_init_std_mode(rx, &mic), "spotpear", "MSM261S4030H0R");
    static const audio_codec_data_if_t speaker_if = {.enable = speaker_enable,
                                                     .write = speaker_write};
    static const audio_codec_data_if_t microphone_if = {.enable = microphone_enable,
                                                        .read = microphone_read};
    esp_codec_dev_cfg_t out_cfg = {.dev_type = ESP_CODEC_DEV_TYPE_OUT, .data_if = &speaker_if};
    esp_codec_dev_cfg_t in_cfg = {.dev_type = ESP_CODEC_DEV_TYPE_IN, .data_if = &microphone_if};
    *speaker = esp_codec_dev_new(&out_cfg);
    *microphone = esp_codec_dev_new(&in_cfg);
    ESP_RETURN_ON_FALSE(*speaker && *microphone, ESP_ERR_NO_MEM, "spotpear", "audio codec bridge");
    ESP_LOGI("spotpear",
             "audio bridge: I2S0 DAC PCM16 stereo, I2S1 mic PCM32 left -> PCM16, 16kHz");
    return ESP_OK;
}
