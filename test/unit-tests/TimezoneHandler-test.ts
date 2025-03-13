/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as tzh from "../../src/TimezoneHandler";

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
});
