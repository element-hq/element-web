/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    M_TEXT,
    type ILocationContent,
    type LocationAssetType,
    M_ASSET,
    M_LOCATION,
    M_TIMESTAMP,
    ContentHelpers,
} from "matrix-js-sdk/src/matrix";

import { isSelfLocation } from "../../../../src/utils/location";

describe("isSelfLocation", () => {
    it("Returns true for a full m.asset event", () => {
        const content = ContentHelpers.makeLocationContent("", "0", Date.now());
        expect(isSelfLocation(content)).toBe(true);
    });

    it("Returns true for a missing m.asset", () => {
        const content = {
            body: "",
            msgtype: "m.location",
            geo_uri: "",
            [M_LOCATION.name]: { uri: "" },
            [M_TEXT.name]: "",
            [M_TIMESTAMP.name]: 0,
            // Note: no m.asset!
        } as unknown as ILocationContent;
        expect(isSelfLocation(content)).toBe(true);
    });

    it("Returns true for a missing m.asset type", () => {
        const content = {
            body: "",
            msgtype: "m.location",
            geo_uri: "",
            [M_LOCATION.name]: { uri: "" },
            [M_TEXT.name]: "",
            [M_TIMESTAMP.name]: 0,
            [M_ASSET.name]: {
                // Note: no type!
            },
        } as unknown as ILocationContent;
        expect(isSelfLocation(content)).toBe(true);
    });

    it("Returns false for an unknown asset type", () => {
        const content = ContentHelpers.makeLocationContent(
            undefined /* text */,
            "geo:foo",
            0,
            undefined /* description */,
            "org.example.unknown" as unknown as LocationAssetType,
        );
        expect(isSelfLocation(content)).toBe(false);
    });
});
