/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { DisambiguatedProfileViewModel } from "../../../src/viewmodels/profile/DisambiguatedProfileViewModel";

describe("DisambiguatedProfileViewModel", () => {
    const member = {
        userId: "@alice:example.org",
        roomId: "!room:example.org",
        rawDisplayName: "Alice",
        disambiguate: true,
    };

    it("should return the snapshot from props", () => {
        const vm = new DisambiguatedProfileViewModel({
            member,
            fallbackName: "Fallback",
            colored: true,
            emphasizeDisplayName: true,
            withTooltip: true,
        });

        expect(vm.getSnapshot()).toEqual({
            displayName: "Alice",
            colorClass: "mx_Username_color3",
            className: undefined,
            displayIdentifier: "@alice:example.org",
            title: "Alice (@alice:example.org)",
            emphasizeDisplayName: true,
        });
    });

    it("should default member fields when member is null", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: null,
            fallbackName: "Fallback",
        });

        expect(vm.getSnapshot()).toMatchObject({
            displayName: "Fallback",
            colorClass: undefined,
            className: undefined,
            displayIdentifier: undefined,
            title: undefined,
            emphasizeDisplayName: undefined,
        });
    });

    it("should pass through className prop", () => {
        const vm = new DisambiguatedProfileViewModel({
            member,
            fallbackName: "Fallback",
            className: "mx_DisambiguatedProfile",
        });

        expect(vm.getSnapshot().className).toBe("mx_DisambiguatedProfile");
    });
});
