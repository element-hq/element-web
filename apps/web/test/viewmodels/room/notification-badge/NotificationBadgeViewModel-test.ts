/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import SettingsStore from "../../../../src/settings/SettingsStore";
import { NotificationLevel } from "../../../../src/stores/notifications/NotificationLevel";
import { NotificationBadgeViewModel } from "../../../../src/viewmodels/room/notification-badge/NotificationBadgeViewModel";

describe("NotificationBadgeViewModel", () => {
    it("computes a highlight badge snapshot", () => {
        const vm = new NotificationBadgeViewModel({
            symbol: "!",
            count: 0,
            level: NotificationLevel.Unsent,
        });

        expect(vm.getSnapshot()).toMatchObject({
            shouldRender: true,
            isVisible: true,
            isHighlight: true,
            badgeType: "badge_2char",
            symbol: "!",
        });

        vm.dispose();
    });

    it("computes a knock badge snapshot", () => {
        const vm = new NotificationBadgeViewModel({
            symbol: "!",
            count: 0,
            level: NotificationLevel.Highlight,
            knocked: true,
        });

        expect(vm.getSnapshot()).toMatchObject({
            shouldRender: true,
            isVisible: true,
            isKnocked: true,
            badgeType: "badge_2char",
            knockLabel: "Request to join sent",
        });

        vm.dispose();
    });

    it("uses dot style for activity and forced notification dots", () => {
        const vm = new NotificationBadgeViewModel({
            symbol: null,
            count: 3,
            level: NotificationLevel.Activity,
        });

        expect(vm.getSnapshot().badgeType).toBe("dot");

        vm.setLevel(NotificationLevel.Notification);
        expect(vm.getSnapshot().badgeType).toBe("badge_2char");

        vm.setForceDot(true);
        expect(vm.getSnapshot().badgeType).toBe("dot");

        vm.dispose();
    });

    it("hides activity when hide-bold is enabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
            return name === "feature_hidebold";
        });

        const vm = new NotificationBadgeViewModel({
            symbol: "",
            count: 1,
            level: NotificationLevel.Activity,
        });

        expect(vm.getSnapshot().shouldRender).toBe(false);

        vm.dispose();
    });

    it("skips setter updates when values are unchanged", () => {
        const vm = new NotificationBadgeViewModel({
            symbol: null,
            count: 3,
            level: NotificationLevel.Notification,
            forceDot: false,
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setSymbol(null);
        vm.setCount(3);
        vm.setLevel(NotificationLevel.Notification);
        vm.setForceDot(false);
        vm.setKnocked(undefined);

        expect(listener).not.toHaveBeenCalled();

        vm.dispose();
    });
});
