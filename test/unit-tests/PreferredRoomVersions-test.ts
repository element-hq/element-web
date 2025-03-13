/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { doesRoomVersionSupport, PreferredRoomVersions } from "../../src/utils/PreferredRoomVersions";

describe("doesRoomVersionSupport", () => {
    it("should detect unstable as unsupported", () => {
        expect(doesRoomVersionSupport("org.example.unstable", "1")).toBe(false);
        expect(doesRoomVersionSupport("1.2-beta", "1")).toBe(false);
    });

    it("should detect support properly", () => {
        expect(doesRoomVersionSupport("1", "2")).toBe(false); // older
        expect(doesRoomVersionSupport("2", "2")).toBe(true); // exact
        expect(doesRoomVersionSupport("3", "2")).toBe(true); // newer
    });

    it("should handle decimal versions", () => {
        expect(doesRoomVersionSupport("1.1", "2.2")).toBe(false); // older
        expect(doesRoomVersionSupport("2.1", "2.2")).toBe(false); // exact-ish
        expect(doesRoomVersionSupport("2.2", "2.2")).toBe(true); // exact
        expect(doesRoomVersionSupport("2.3", "2.2")).toBe(true); // exact-ish
        expect(doesRoomVersionSupport("3.1", "2.2")).toBe(true); // newer
    });

    it("should detect knock rooms in v7 and above", () => {
        expect(doesRoomVersionSupport("6", PreferredRoomVersions.KnockRooms)).toBe(false);
        expect(doesRoomVersionSupport("7", PreferredRoomVersions.KnockRooms)).toBe(true);
        expect(doesRoomVersionSupport("8", PreferredRoomVersions.KnockRooms)).toBe(true);
        expect(doesRoomVersionSupport("9", PreferredRoomVersions.KnockRooms)).toBe(true);
        expect(doesRoomVersionSupport("10", PreferredRoomVersions.KnockRooms)).toBe(true);
    });

    it("should detect restricted rooms in v9 and v10", () => {
        // Dev note: we consider it a feature that v8 rooms have to upgrade considering the bug in v8.
        // https://spec.matrix.org/v1.3/rooms/v8/#redactions
        expect(doesRoomVersionSupport("8", PreferredRoomVersions.RestrictedRooms)).toBe(false);
        expect(doesRoomVersionSupport("9", PreferredRoomVersions.RestrictedRooms)).toBe(true);
        expect(doesRoomVersionSupport("10", PreferredRoomVersions.RestrictedRooms)).toBe(true);
    });
});
