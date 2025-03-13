/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { locationEventGeoUri } from "../../../../src/utils/location";
import { makeLegacyLocationEvent, makeLocationEvent } from "../../../test-utils/location";

describe("locationEventGeoUri()", () => {
    it("returns m.location uri when available", () => {
        expect(locationEventGeoUri(makeLocationEvent("geo:51.5076,-0.1276"))).toEqual("geo:51.5076,-0.1276");
    });

    it("returns legacy uri when m.location content not found", () => {
        expect(locationEventGeoUri(makeLegacyLocationEvent("geo:51.5076,-0.1276"))).toEqual("geo:51.5076,-0.1276");
    });
});
