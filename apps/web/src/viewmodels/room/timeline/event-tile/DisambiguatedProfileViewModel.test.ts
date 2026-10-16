/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, afterEach } from "vitest";

import { DisambiguatedProfileViewModel } from "./DisambiguatedProfileViewModel";
import { ModuleApi } from "../../../../modules/Api";

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
            displayIdentifier: "@alice:example.org",
            title: "Alice (@alice:example.org)",
            emphasizeDisplayName: true,
            badges: [],
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
            displayIdentifier: undefined,
            title: undefined,
            emphasizeDisplayName: undefined,
        });
    });

    it("should delegate onClick without emitting a snapshot update", () => {
        const onClick = vi.fn();
        const vm = new DisambiguatedProfileViewModel({
            member,
            fallbackName: "Fallback",
            onClick,
        });
        const prevSnapshot = vm.getSnapshot();
        const subscriber = vi.fn();

        vm.subscribe(subscriber);
        vm.onClick?.({} as never);

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(subscriber).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toBe(prevSnapshot);
    });

    it("should keep onClick bound when extracted as a callback", () => {
        const onClick = vi.fn();
        const vm = new DisambiguatedProfileViewModel({
            member,
            fallbackName: "Fallback",
            onClick,
        });

        const clickHandler = vm.onClick;

        expect(() => clickHandler?.({} as never)).not.toThrow();
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should emit snapshot update when fallbackName changes", () => {
        const vm = new DisambiguatedProfileViewModel({
            member: null,
            fallbackName: "Fallback",
        });
        const subscriber = vi.fn();

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
        const subscriber = vi.fn();

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
        const subscriber = vi.fn();

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
        const subscriber = vi.fn();

        vm.subscribe(subscriber);
        vm.setMember("Fallback", member);

        expect(subscriber).toHaveBeenCalledTimes(1);
    });

    describe("badges", () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("should include module badges for the user", () => {
            const badges = [React.createElement("span", { key: "guest" }, "Guest")];
            const renderBadges = vi
                .spyOn(ModuleApi.instance.customComponents, "renderSenderProfileBadges")
                .mockReturnValue(badges);

            const vm = new DisambiguatedProfileViewModel({ member, fallbackName: "Fallback" });

            expect(renderBadges).toHaveBeenCalledWith({ userId: "@alice:example.org" });
            expect(vm.getSnapshot().badges).toBe(badges);
        });

        it("should not include badges when there is no member", () => {
            const renderBadges = vi.spyOn(ModuleApi.instance.customComponents, "renderSenderProfileBadges");

            const vm = new DisambiguatedProfileViewModel({ member: null, fallbackName: "Fallback" });

            expect(renderBadges).not.toHaveBeenCalled();
            expect(vm.getSnapshot().badges).toBeUndefined();
        });
    });
});
