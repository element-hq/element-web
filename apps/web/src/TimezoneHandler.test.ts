/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";

import * as tzh from "./TimezoneHandler";

describe("TimezoneHandler", () => {
    it("should support setting a user timezone", async () => {
        const tz = "Europe/Paris";
        await tzh.setUserTimezone(tz);
        expect(tzh.getUserTimezone()).toEqual(tz);
    });
    it("Return undefined with an empty TZ", async () => {
        await tzh.setUserTimezone("");
        expect(tzh.getUserTimezone()).toEqual(undefined);
    });
    it("should include UTC in the available timezones", () => {
        vi.spyOn(Intl, "supportedValuesOf").mockReturnValueOnce(["Europe/London", "Europe/Paris"]);
        expect(tzh.getAllTimezones()).toEqual(["UTC", "Europe/London", "Europe/Paris"]);
    });
    it("should not duplicate UTC if the browser already provides it", () => {
        vi.spyOn(Intl, "supportedValuesOf").mockReturnValueOnce(["Europe/London", "UTC"]);
        expect(tzh.getAllTimezones()).toEqual(["Europe/London", "UTC"]);
    });
});
