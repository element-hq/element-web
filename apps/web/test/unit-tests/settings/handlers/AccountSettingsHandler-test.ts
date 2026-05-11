/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import AccountSettingsHandler from "../../../../src/settings/handlers/AccountSettingsHandler.ts";
import { WatchManager } from "../../../../src/settings/WatchManager.ts";
import { stubClient } from "../../../test-utils";

describe("AccountSettingsHandler", () => {
    const watchManager = new WatchManager();
    const handler = new AccountSettingsHandler(watchManager);

    beforeEach(stubClient);

    it("should notify watchers of recent_emoji on account data update", async () => {
        const fn = jest.fn();
        handler.watchers.watchSetting("recent_emoji", null, fn);

        const ev = new MatrixEvent({
            type: "io.element.recent_emoji",
            content: {
                recent_emoji: [["🤒", 1]],
            },
        });
        mocked(handler.client.getAccountData).mockImplementation((eventType) =>
            eventType === "io.element.recent_emoji" ? ev : undefined,
        );
        handler.client.emit(ClientEvent.AccountData, ev);

        expect(fn).toHaveBeenCalledWith(null, "account", [{ emoji: "🤒", total: 1 }]);
    });

    it("should write value to account data correctly", async () => {
        void handler.setValue("pseudonymousAnalyticsOptIn", null, true);

        expect(handler.client.setAccountData).toHaveBeenCalledWith("im.vector.analytics", {
            pseudonymousAnalyticsOptIn: true,
        });
    });
});
