/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, afterEach, beforeEach } from "vitest";

import * as tzh from "./TimezoneHandler";
import SettingsStore from "./settings/SettingsStore";
import { unmockIntlDateTimeFormat } from "test-utils/date";

describe("TimezoneHandler", () => {
    beforeEach(() => {
        // The global test setup forces every DateTimeFormat to UTC, which would hide the normalisation.
        unmockIntlDateTimeFormat();
    });
    afterEach(() => {
        SettingsStore.reset();
    });
    it("should support setting a user timezone", async () => {
        const tz = "Europe/Paris";
        await tzh.setUserTimezone(tz);
        expect(tzh.getUserTimezone()).toEqual(tz);
    });
    it("Return undefined with an empty TZ", async () => {
        await tzh.setUserTimezone("");
        expect(tzh.getUserTimezone()).toEqual(undefined);
    });
    it("should normalise the casing of the user timezone", async () => {
        await tzh.setUserTimezone("europe/PARIS");
        expect(tzh.getUserTimezone()).toEqual("Europe/Paris");
    });
    it("should return undefined for an invalid user timezone", async () => {
        await tzh.setUserTimezone("Europe/Nowhere");
        expect(tzh.getUserTimezone()).toEqual(undefined);
    });
    it("should return user set timezone in getAllTimezones", async () => {
        // UTC is not returned by getAllTimezones() but is supported
        // by browesers.
        expect(tzh.getAllTimezones()).not.toContain("UTC");
        await tzh.setUserTimezone("UTC");
        expect(tzh.getAllTimezones()).toContain("UTC");
    });
});
