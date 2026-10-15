/* SPDX-License-Identifier: Apache-2.0 */
#pragma once
#include "sdkconfig.h"
#include <stdio.h>
#include <string.h>
#if CONFIG_MUSE_BOARD_SPOTPEAR_S3_180_V1
#include "../../secrets/muse-relay.h"
#ifdef MUSE_RELAY_DIRECT
#define MUSE_RELAY_ENABLED 0
#else
#define MUSE_RELAY_ENABLED 1
#endif
#ifdef MUSE_RELAY_ADDRESS
#define MUSE_RELAY_CONNECT_HOST MUSE_RELAY_ADDRESS
#else
#define MUSE_RELAY_CONNECT_HOST MUSE_RELAY_HOST
#endif
#define MUSE_RELAY_API "https://" MUSE_RELAY_CONNECT_HOST
#else
#define MUSE_RELAY_ENABLED 0
#define MUSE_RELAY_HOST ""
#define MUSE_RELAY_CONNECT_HOST ""
#define MUSE_RELAY_KEY ""
#define MUSE_RELAY_API ""
#endif
/* Append private relay authentication before the terminating empty line.
 * Muse authorization and Noise payloads remain untouched. */
static inline int muse_relay_upgrade(char *request, size_t cap, int length)
{
    if (!MUSE_RELAY_ENABLED) return length;
    if (length < 2 || (size_t)length >= cap) return -1;
    int n = snprintf(request + length - 2, cap - length + 2,
                     "X-Muse-Relay-Key: %s\r\n\r\n", MUSE_RELAY_KEY);
    return n < 0 || (size_t)n >= cap - length + 2 ? -1 : length - 2 + n;
}
