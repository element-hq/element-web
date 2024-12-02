/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import { test as base } from "../../element-web-test";

/**
 * Set up for share dialog tests.
 */
export const test = base.extend<{
    roomName?: string;
}>({
    displayName: "Alice",
    botCreateOpts: { displayName: "Other User" },

    roomName: "Alice room",
    room: async ({ roomName: name, app, user, bot }, use) => {
        const roomId = await app.client.createRoom({ name, invite: [bot.credentials.userId] });
        await use({ roomId });
    },
});
