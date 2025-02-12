/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMockJest from "fetch-mock-jest";
import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/matrix";

import { SettingLevel } from "../../../../src/settings/SettingLevel";
import FallbackIceServerController from "../../../../src/settings/controllers/FallbackIceServerController.ts";
import MatrixClientBackedController from "../../../../src/settings/controllers/MatrixClientBackedController.ts";
import SettingsStore from "../../../../src/settings/SettingsStore.ts";

describe("FallbackIceServerController", () => {
    beforeEach(() => {
        fetchMockJest.get("https://matrix.org/_matrix/client/versions", { versions: ["v1.4"] });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should update MatrixClient's state when the setting is updated", async () => {
        const client = new MatrixClient({
            baseUrl: "https://matrix.org",
            userId: "@alice:matrix.org",
            accessToken: "token",
        });
        MatrixClientBackedController.matrixClient = client;

        expect(client.isFallbackICEServerAllowed()).toBeFalsy();
        await SettingsStore.setValue("fallbackICEServerAllowed", null, SettingLevel.DEVICE, true);
        expect(client.isFallbackICEServerAllowed()).toBeTruthy();
    });

    it("should force the setting to be disabled if disable_fallback_ice=true", async () => {
        const controller = new FallbackIceServerController();
        const client = new MatrixClient({
            baseUrl: "https://matrix.org",
            userId: "@alice:matrix.org",
            accessToken: "token",
        });
        MatrixClientBackedController.matrixClient = client;
        expect(controller.settingDisabled).toBeFalsy();

        client["clientWellKnown"] = {
            "io.element.voip": {
                disable_fallback_ice: true,
            },
        };
        client.emit(ClientEvent.ClientWellKnown, client["clientWellKnown"]);

        expect(controller.settingDisabled).toBeTruthy();
    });
});
