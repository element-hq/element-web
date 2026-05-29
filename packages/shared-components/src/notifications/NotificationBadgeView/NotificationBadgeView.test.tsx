/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "@test-utils";
import { composeStories } from "@storybook/react-vite";
import React from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockViewModel } from "../../core/viewmodel";
import {
    NotificationBadgeView,
    type NotificationBadgeViewActions,
    type NotificationBadgeViewModel,
    type NotificationBadgeViewSnapshot,
} from "./NotificationBadgeView";
import * as stories from "./NotificationBadgeView.stories";

const { Notification, Dot, Knocked, Hidden } = composeStories(stories);

describe("NotificationBadgeView", () => {
    it("renders the default notification badge", () => {
        const { container } = render(<Notification />);

        expect(container).toMatchSnapshot();
    });

    it("renders a dot badge", () => {
        const { container } = render(<Dot />);

        expect(container.querySelector(".mx_NotificationBadge_dot")).toBeInTheDocument();
    });

    it("renders a knocked badge icon", () => {
        render(<Knocked />);

        expect(screen.getByLabelText("Request to join sent")).toBeInTheDocument();
    });

    it("does not render when hidden", () => {
        const { container } = render(<Hidden />);

        expect(container.firstChild).toBeNull();
    });

    it("invokes click and keyboard actions", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();

        class TestNotificationBadgeViewModel
            extends MockViewModel<NotificationBadgeViewSnapshot>
            implements NotificationBadgeViewActions
        {
            public constructor(
                snapshot: NotificationBadgeViewSnapshot,
                public onClick: NotificationBadgeViewActions["onClick"],
            ) {
                super(snapshot);
            }
        }

        const vm = new TestNotificationBadgeViewModel(
            {
                shouldRender: true,
                isVisible: true,
                isNotification: false,
                isHighlight: false,
                isKnocked: false,
                badgeType: "badge_2char",
                symbol: "3",
                isClickable: true,
            },
            onClick,
        ) as NotificationBadgeViewModel;

        render(<NotificationBadgeView vm={vm} />);

        const button = screen.getByRole("button");
        await user.click(button);
        button.focus();
        await user.keyboard("{Enter}");
        await user.keyboard(" ");

        expect(onClick).toHaveBeenCalledTimes(3);
    });
});
