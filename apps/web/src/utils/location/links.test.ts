/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import { mkMessage, makeLegacyLocationEvent, makeLocationEvent } from "test-utils";

import { createMapSiteLinkFromEvent } from "./links";

describe("createMapSiteLinkFromEvent", () => {
    it("returns null if event does not contain geouri", () => {
        expect(
            createMapSiteLinkFromEvent(
                mkMessage({
                    room: "1",
                    user: "@sender:server",
                    event: true,
                }),
            ),
        ).toBeNull();
    });

    it("returns OpenStreetMap link if event contains m.location with valid uri", () => {
        expect(createMapSiteLinkFromEvent(makeLocationEvent("geo:51.5076,-0.1276"))).toEqual(
            "https://www.openstreetmap.org/" + "?mlat=51.5076&mlon=-0.1276" + "#map=16/51.5076/-0.1276",
        );
    });

    it("returns null if event contains m.location with invalid uri", () => {
        expect(createMapSiteLinkFromEvent(makeLocationEvent("123 Sesame St"))).toBeNull();
    });

    it("returns OpenStreetMap link if event contains geo_uri", () => {
        expect(createMapSiteLinkFromEvent(makeLegacyLocationEvent("geo:51.5076,-0.1276"))).toEqual(
            "https://www.openstreetmap.org/" + "?mlat=51.5076&mlon=-0.1276" + "#map=16/51.5076/-0.1276",
        );
    });

    it("returns null if event contains an invalid geo_uri", () => {
        expect(createMapSiteLinkFromEvent(makeLegacyLocationEvent("123 Sesame St"))).toBeNull();
    });
});
