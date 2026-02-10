/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { setUpCommandTest } from "./utils";

describe("SlashCommands", () => {
    const roomId = "!room:example.com";

    describe.each([
        ["myroomnick"],
        ["roomavatar"],
        ["myroomavatar"],
        ["topic"],
        ["roomname"],
        ["invite"],
        ["part"],
        ["remove"],
        ["ban"],
        ["unban"],
        ["op"],
        ["deop"],
        ["addwidget"],
        ["discardsession"],
        ["whois"],
        ["holdcall"],
        ["unholdcall"],
        ["converttodm"],
        ["converttoroom"],
    ])("/%s", (commandName: string) => {
        describe("isEnabled", () => {
            it("should return true for Room", () => {
                const { client, command } = setUpCommandTest(roomId, `/${commandName}`);
                expect(command.isEnabled(client, roomId)).toBe(true);
            });

            it("should return false for LocalRoom", () => {
                const { client, command } = setUpCommandTest(roomId, `/${commandName}`, true);
                expect(command.isEnabled(client, roomId)).toBe(false);
            });
        });
    });
});
