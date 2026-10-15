/* SPDX-License-Identifier: Apache-2.0 */
#include "spotpear.h"
#include "driver/sdmmc_host.h"
#include "sdmmc_cmd.h"
#include "esp_vfs_fat.h"
#include "esp_log.h"
static sdmmc_card_t *card;
esp_err_t spotpear_storage_mount(void)
{
    if (card)
        return ESP_OK;
    sdmmc_host_t host = SDMMC_HOST_DEFAULT();
    host.max_freq_khz = SDMMC_FREQ_DEFAULT;
    sdmmc_slot_config_t slot = SDMMC_SLOT_CONFIG_DEFAULT();
    slot.width = 4;
    slot.clk = 3;
    slot.cmd = 4;
    slot.d0 = 2;
    slot.d1 = 1;
    slot.d2 = 6;
    slot.d3 = 5;
    slot.flags |= SDMMC_SLOT_FLAG_INTERNAL_PULLUP;
    esp_vfs_fat_sdmmc_mount_config_t config = {
        .format_if_mount_failed = false, .max_files = 5, .allocation_unit_size = 16384};
    esp_err_t err = esp_vfs_fat_sdmmc_mount("/sdcard", &host, &slot, &config, &card);
    if (err == ESP_OK)
        ESP_LOGI("spotpear", "SD mounted /sdcard, %llu bytes",
                 (unsigned long long)card->csd.capacity * card->csd.sector_size);
    return err;
}
