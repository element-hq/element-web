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
    const nonDisambiguatedMember = {
        ...member,
        disambiguate: false,
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

    it("should delegate onClick without emitting a snapshot update", () => {
        const onClick = jest.fn();
        const vm = new DisambiguatedProfileViewModel({
            member,
            fallbackName: "Fallback",
            onClick,
        });
        const prevSnapshot = vm.getSnapshot();
        const subscriber = jest.fn();

        vm.subscribe(subscriber);
        onClick({} as never);

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(subscriber).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toBe(prevSnapshot);
    });

    it("should emit snapshot update when fallbackName changes", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: null,
            fallbackName: "Fallback",
        });
        const subscriber = jest.fn();

        vm.subscribe(subscriber);
        vm.setMember("Updated");

        expect(subscriber).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot().displayName).toBe("Updated");
    });

    it("should emit snapshot update when setMember is called even if fallbackName is unchanged", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: null,
            fallbackName: "Fallback",
        });
        const subscriber = jest.fn();

        vm.subscribe(subscriber);
        vm.setMember("Fallback");

        expect(subscriber).toHaveBeenCalledTimes(1);
    });

    it("should compute tooltip title from constructor props when withTooltip is true", () => {
        const vm = new DisambiguatedProfileViewModel({
            member,
            fallbackName: "Fallback",
            withTooltip: true,
        });

        expect(vm.getSnapshot().title).toBe("Alice (@alice:example.org)");
    });

    it("should compute tooltip title even when disambiguation is not needed", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: nonDisambiguatedMember,
            fallbackName: "Fallback",
            withTooltip: true,
        });

        expect(vm.getSnapshot().title).toBe("Alice (@alice:example.org)");
    });

    it("should emit snapshot update when member changes via setMember", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: null,
            fallbackName: "Fallback",
        });
        const subscriber = jest.fn();

        vm.subscribe(subscriber);
        vm.setMember("Fallback", member);

        expect(subscriber).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot().displayName).toBe("Alice");
    });

    it("should emit snapshot update when setMember is called with unchanged member", () => {
        const vm = new DisambiguatedProfileViewModel({
            member,
            fallbackName: "Fallback",
        });
        const subscriber = jest.fn();

        vm.subscribe(subscriber);
        vm.setMember("Fallback", member);

        expect(subscriber).toHaveBeenCalledTimes(1);
    });
});
