/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { render, screen } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { RoomListItemNotificationMenu } from "./RoomListItemNotificationMenu";
import { RoomNotifState } from "./RoomNotifs";
import { useMockedViewModel } from "../../../../core/viewmodel";
import type { RoomListItemViewSnapshot } from "./RoomListItemView";
import { defaultSnapshot } from "./default-snapshot";
import { mockedActions as mockCallbacks } from "./mocked-actions";

describe("<RoomListItemNotificationMenu />", () => {
    // Rendered on its own, outside of the more options menu, the submenu shows its entries directly
    const renderMenu = (
        roomNotifState: RoomNotifState = RoomNotifState.AllMessages,
        overrides: Partial<RoomListItemViewSnapshot> = {},
    ): ReturnType<typeof render> => {
        const TestComponent = (): JSX.Element => {
            const vm = useMockedViewModel(
                { ...defaultSnapshot, showNotificationMenu: true, roomNotifState, ...overrides },
                mockCallbacks,
            );
            return <RoomListItemNotificationMenu vm={vm} />;
        };
        return render(<TestComponent />);
    };

    /** The labels of the notification options, in the order they are shown */
    const getOptionLabels = (): (string | null)[] =>
        screen
            .getAllByRole("menuitem")
            .filter((item) => item.hasAttribute("aria-selected"))
            .map((item) => item.textContent);

    beforeEach(() => {
        vi.mocked(mockCallbacks.onSetRoomNotifState).mockClear();
        vi.mocked(mockCallbacks.onToggleAgent).mockClear();
        vi.mocked(mockCallbacks.onSetAgentReplyMarking).mockClear();
    });

    it("should render the notification options entry", () => {
        renderMenu();
        expect(screen.getByRole("menuitem", { name: "Notification options" })).toBeInTheDocument();
    });

    it("should show the muted icon when notifications are muted", () => {
        const { container: unmuted } = renderMenu(RoomNotifState.AllMessages);
        const unmutedIcon = unmuted.querySelector("svg")?.innerHTML;
        const { container: muted } = renderMenu(RoomNotifState.Mute);
        expect(muted.querySelector("svg")?.innerHTML).not.toEqual(unmutedIcon);
    });

    it("should only offer Normal and Silent", () => {
        renderMenu(RoomNotifState.AllMessages, { canUseAgent: true });
        expect(getOptionLabels()).toEqual(["Normal", "Silent"]);
    });

    it.each([
        ["Normal", RoomNotifState.AllMessages],
        ["Silent", RoomNotifState.Mute],
    ])("should call onSetRoomNotifState when %s is selected", async (label, state) => {
        const user = userEvent.setup();
        renderMenu();

        await user.click(screen.getByRole("menuitem", { name: label }));

        expect(mockCallbacks.onSetRoomNotifState).toHaveBeenCalledWith(state);
    });

    it.each([
        [RoomNotifState.AllMessages, "Normal", "Silent"],
        [RoomNotifState.Mute, "Silent", "Normal"],
    ])("should mark the selected option for %s", (state, selected, other) => {
        renderMenu(state);

        expect(screen.getByRole("menuitem", { name: selected })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("menuitem", { name: other })).toHaveAttribute("aria-selected", "false");
    });

    it.each([RoomNotifState.AllMessagesLoud, RoomNotifState.MentionsOnly])(
        "should mark neither option for a room set to %s elsewhere",
        (state) => {
            renderMenu(state);

            expect(screen.getByRole("menuitem", { name: "Normal" })).toHaveAttribute("aria-selected", "false");
            expect(screen.getByRole("menuitem", { name: "Silent" })).toHaveAttribute("aria-selected", "false");
        },
    );

    describe("agent", () => {
        it("should not offer the agent where it can't be used", () => {
            renderMenu(RoomNotifState.AllMessages, { canUseAgent: false });
            expect(screen.queryByRole("menuitemcheckbox", { name: "Agent" })).not.toBeInTheDocument();
        });

        it.each([false, true])("should show whether the agent replies: %s", (isAgent) => {
            renderMenu(RoomNotifState.AllMessages, { canUseAgent: true, isAgent });
            expect(screen.getByRole("menuitemcheckbox", { name: "Agent" })).toHaveAttribute(
                "aria-checked",
                String(isAgent),
            );
        });

        it("should toggle the agent, independently of the notification options", async () => {
            const user = userEvent.setup();
            renderMenu(RoomNotifState.Mute, { canUseAgent: true });

            await user.click(screen.getByRole("menuitemcheckbox", { name: "Agent" }));

            expect(mockCallbacks.onToggleAgent).toHaveBeenCalled();
            expect(mockCallbacks.onSetRoomNotifState).not.toHaveBeenCalled();
        });

        it("should only offer how replies are marked while the agent replies", () => {
            renderMenu(RoomNotifState.AllMessages, { canUseAgent: true, isAgent: false });
            expect(screen.queryByRole("menuitem", { name: "Mark as AI reply" })).not.toBeInTheDocument();
        });

        it.each([
            ["notice", "Mark as AI reply"],
            ["marker", "Hidden marker only"],
            ["none", "Not marked"],
        ] as const)("should mark how replies are marked: %s", (agentReplyMarking, selected) => {
            renderMenu(RoomNotifState.AllMessages, { canUseAgent: true, isAgent: true, agentReplyMarking });

            for (const label of ["Mark as AI reply", "Hidden marker only", "Not marked"]) {
                expect(screen.getByRole("menuitem", { name: label })).toHaveAttribute(
                    "aria-selected",
                    String(label === selected),
                );
            }
        });

        it.each([
            ["Mark as AI reply", "notice"],
            ["Hidden marker only", "marker"],
            ["Not marked", "none"],
        ])("should call onSetAgentReplyMarking when %s is selected", async (label, marking) => {
            const user = userEvent.setup();
            renderMenu(RoomNotifState.AllMessages, { canUseAgent: true, isAgent: true });

            await user.click(screen.getByRole("menuitem", { name: label }));

            expect(mockCallbacks.onSetAgentReplyMarking).toHaveBeenCalledWith(marking);
            expect(mockCallbacks.onSetRoomNotifState).not.toHaveBeenCalled();
        });
    });
});
