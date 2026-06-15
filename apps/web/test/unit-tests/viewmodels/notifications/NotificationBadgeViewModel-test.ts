/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { NotificationBadgeViewModel } from "../../../../src/viewmodels/notifications/NotificationBadgeViewModel";
import { NotificationLevel } from "../../../../src/stores/notifications/NotificationLevel";

describe("NotificationBadgeViewModel", () => {
    it("computes an activity dot snapshot", () => {
        const vm = new NotificationBadgeViewModel({
            symbol: null,
            count: 0,
            level: NotificationLevel.Activity,
        });

        expect(vm.getSnapshot()).toMatchObject({
            shouldRender: true,
            isVisible: true,
            symbol: null,
            isNotification: false,
            isHighlight: false,
            isKnocked: false,
            badgeType: "dot",
            isClickable: false,
        });
    });

    it("hides activity dots when hideIfDot changes and skips unchanged setters", () => {
        const vm = new NotificationBadgeViewModel({
            symbol: null,
            count: 0,
            level: NotificationLevel.Activity,
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setHideIfDot(false);
        expect(listener).not.toHaveBeenCalled();

        vm.setHideIfDot(true);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot().shouldRender).toBe(false);

        vm.setHideIfDot(true);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("formats counts and maps highlight levels", () => {
        const vm = new NotificationBadgeViewModel({
            symbol: null,
            count: 3,
            level: NotificationLevel.Notification,
        });

        vm.setNotificationData({
            symbol: null,
            count: 4,
            level: NotificationLevel.Unsent,
        });

        expect(vm.getSnapshot()).toMatchObject({
            shouldRender: true,
            isVisible: true,
            symbol: "4",
            isHighlight: true,
            badgeType: "badge_2char",
        });
    });

    it("hides activity badges when hide bold is enabled", () => {
        const vm = new NotificationBadgeViewModel({
            symbol: "",
            count: 1,
            level: NotificationLevel.Activity,
        });

        vm.setHideBold(true);

        expect(vm.getSnapshot().shouldRender).toBe(false);
    });

    it("updates clickable options without emitting for unchanged values", () => {
        const onClick = jest.fn();
        const vm = new NotificationBadgeViewModel({
            symbol: "!",
            count: 0,
            level: NotificationLevel.Highlight,
            onClick,
            ariaLabel: "Jump to unread",
            tabIndex: 0,
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setClickOptions({
            onClick,
            ariaLabel: "Jump to unread",
            tabIndex: 0,
        });
        expect(listener).not.toHaveBeenCalled();

        vm.setClickOptions({
            onClick,
            ariaLabel: "Jump to first unread room",
            tabIndex: 0,
        });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot()).toMatchObject({
            isClickable: true,
            ariaLabel: "Jump to first unread room",
            tabIndex: 0,
        });
    });
});
