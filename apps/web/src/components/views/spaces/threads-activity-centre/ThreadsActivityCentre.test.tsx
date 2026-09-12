/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeAll } from "vitest";
import React, { type ComponentProps } from "react";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { stubClient } from "test-utils";
import { populateThread } from "test-utils/threads";
import { NotificationCountType, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";

import { ThreadsActivityCentre, threadDecorationProps } from "./ThreadsActivityCentre";
import { NotificationLevel } from "../../../../stores/notifications/NotificationLevel";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import DMRoomMap from "../../../../utils/DMRoomMap";

describe("ThreadsActivityCentre", () => {
    const getTACButton = () => {
        return screen.getByRole("button", { name: "Threads" });
    };

    const getTACMenu = () => {
        return screen.getByRole("menu");
    };

    const getTACDescription = (container: ReturnType<typeof render>["container"]) => {
        return container.querySelector(".mx_ThreadsActivityCentreButton_Text");
    };

    const renderTAC = (props?: ComponentProps<typeof ThreadsActivityCentre>) => {
        return render(
            <MatrixClientContext.Provider value={cli}>
                <ThreadsActivityCentre {...props} />
            </MatrixClientContext.Provider>,
        );
    };

    const cli = stubClient();
    cli.supportsThreads = () => true;

    const userId = cli.getSafeUserId();

    const roomWithNotif = new Room("!room2:server", cli, userId, {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithNotif.name = "A notification";

    const roomWithHighlight = new Room("!room3:server", cli, userId, {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithHighlight.name = "This is a real highlight";

    // Room with a thread by another user (appears in "Other threads" only)
    const roomWithOtherThread = new Room("!room6:server", cli, userId, {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithOtherThread.name = "Other user thread";

    // Room with a thread by another user that mentions/keywords the current user (highlight)
    // Should appear in "My threads" because highlight > 0 makes it relevant
    const roomWithHighlightOtherAuthor = new Room("!room7:server", cli, userId, {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithHighlightOtherAuthor.name = "Keyword mention thread";

    // Room whose thread carries a notification count greater than one, to check it is displayed
    const roomWithManyNotifs = new Room("!room8:server", cli, userId, {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithManyNotifs.name = "Three notifications";

    // Room whose thread is only locally unread: no server-reported counts at all
    const roomWithActivityOnly = new Room("!room9:server", cli, userId, {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithActivityOnly.name = "Activity only";

    const getDefaultThreadArgs = (room: Room) => ({
        room: room,
        client: cli,
        authorId: userId,
        participantUserIds: ["@fee:bar"],
    });

    beforeAll(async () => {
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(cli);
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(cli);

        const dmRoomMap = new DMRoomMap(cli);
        vi.spyOn(dmRoomMap, "getUserIdForRoomId");
        vi.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);

        // Thread where current user participated (notification level)
        const notifThreadInfo = await populateThread(getDefaultThreadArgs(roomWithNotif));
        roomWithNotif.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 1);
        // Mock the server-provided participation flag (processRootEvent is async)
        vi.spyOn(notifThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(true);

        // Thread where current user participated (highlight level)
        const highlightThreadInfo = await populateThread({
            ...getDefaultThreadArgs(roomWithHighlight),
            ts: 5,
        });
        roomWithHighlight.setThreadUnreadNotificationCount(
            highlightThreadInfo.thread.id,
            NotificationCountType.Highlight,
            1,
        );
        vi.spyOn(highlightThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(true);

        // Thread by another user, no participation (notification level → Other threads)
        const otherThreadInfo = await populateThread({
            room: roomWithOtherThread,
            client: cli,
            authorId: "@other:bar",
            participantUserIds: ["@someone:bar"],
        });
        roomWithOtherThread.setThreadUnreadNotificationCount(otherThreadInfo.thread.id, NotificationCountType.Total, 1);
        vi.spyOn(otherThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(false);

        // Thread by another user, but with a highlight for current user (keyword match)
        // → should appear in "My threads" because highlight makes it relevant
        const highlightOtherThreadInfo = await populateThread({
            room: roomWithHighlightOtherAuthor,
            client: cli,
            authorId: "@other:bar",
            participantUserIds: ["@someone:bar"],
            ts: 10,
        });
        roomWithHighlightOtherAuthor.setThreadUnreadNotificationCount(
            highlightOtherThreadInfo.thread.id,
            NotificationCountType.Highlight,
            1,
        );
        vi.spyOn(highlightOtherThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(false);

        // Participated thread with three notifications, to check the count is surfaced
        const manyNotifsThreadInfo = await populateThread({
            ...getDefaultThreadArgs(roomWithManyNotifs),
            ts: 15,
        });
        roomWithManyNotifs.setThreadUnreadNotificationCount(
            manyNotifsThreadInfo.thread.id,
            NotificationCountType.Total,
            3,
        );
        vi.spyOn(manyNotifsThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(true);

        // Participated thread with no server counts at all: unread is detected locally only
        const activityThreadInfo = await populateThread({
            room: roomWithActivityOnly,
            client: cli,
            authorId: "@other:bar",
            participantUserIds: ["@someone:bar"],
            ts: 20,
        });
        vi.spyOn(activityThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(true);
    });

    /** The notification decoration of the only row currently rendered. */
    const getRowDecoration = (): HTMLElement => {
        const row = screen.getAllByRole("menuitem")[0];
        const decoration = row.querySelector<HTMLElement>('[data-testid="notification-decoration"]');
        expect(decoration).not.toBeNull();
        return decoration!;
    };

    it("should render the threads activity centre button", async () => {
        renderTAC();
        expect(getTACButton()).toBeInTheDocument();
    });

    it("should render the threads activity centre button and the display label", async () => {
        const { container } = renderTAC({ displayButtonLabel: true });
        expect(getTACButton()).toBeInTheDocument();
        expect(getTACDescription(container)).toBeInTheDocument();
    });

    it("should render the threads activity centre menu when the button is clicked", async () => {
        renderTAC();
        await userEvent.click(getTACButton());
        expect(getTACMenu()).toBeInTheDocument();
    });

    it("should show My threads tab by default with participated threads", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithNotif]);
        renderTAC();
        await userEvent.click(getTACButton());

        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);
    });

    it("should render a participated thread with notification in My threads", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithNotif]);
        renderTAC();
        await userEvent.click(getTACButton());

        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);
        expect(tacRows[0].querySelectorAll('[data-notification-level="notification"]').length).toEqual(1);
    });

    it("should render a participated thread with highlight in My threads", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithHighlight]);
        renderTAC();
        await userEvent.click(getTACButton());

        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);
        expect(tacRows[0].querySelectorAll('[data-notification-level="highlight"]').length).toEqual(1);
    });

    it("should show a highlighted thread by another user in My threads (keyword/mention)", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithHighlightOtherAuthor]);
        renderTAC();
        await userEvent.click(getTACButton());

        // Even though the user didn't participate, highlight > 0 makes it relevant → My threads
        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);
        expect(tacRows[0].querySelectorAll('[data-notification-level="highlight"]').length).toEqual(1);
    });

    it("should display the notification count on a notified thread", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithManyNotifs]);
        renderTAC();
        await userEvent.click(getTACButton());

        const decoration = getRowDecoration();
        // The counter shows the number, and there is no mention icon
        expect(decoration).toHaveTextContent("3");
        expect(decoration.querySelectorAll("svg").length).toEqual(0);
    });

    it("should display the mention icon on a highlighted thread", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithHighlight]);
        renderTAC();
        await userEvent.click(getTACButton());

        const decoration = getRowDecoration();
        expect(decoration.querySelectorAll("svg").length).toEqual(1);
        // This fixture only reports a highlight count, so the counter beside the icon stays empty
        expect(decoration).not.toHaveTextContent(/\d/);
    });

    it("should display a bare activity indicator on a locally-unread thread", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithActivityOnly]);
        renderTAC();
        await userEvent.click(getTACButton());

        const decoration = getRowDecoration();
        // Neither a mention icon nor a count: just the activity dot
        expect(decoration.querySelectorAll("svg").length).toEqual(0);
        expect(decoration).not.toHaveTextContent(/\d/);
    });

    it("should describe the unread state of a row for screen readers", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithManyNotifs]);
        renderTAC();
        await userEvent.click(getTACButton());

        // The row overrides its own content with aria-label, so the count has to be spelled out
        expect(screen.getAllByRole("menuitem")[0]).toHaveAccessibleName(/3 unread messages\./);
    });

    it("should show other threads in the Other threads tab", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithOtherThread]);
        renderTAC();
        await userEvent.click(getTACButton());

        // Default "My threads" tab should be empty (no participation, no highlight)
        expect(screen.queryAllByRole("menuitem").length).toEqual(0);

        // Switch to "Other threads" tab
        await userEvent.click(screen.getByRole("tab", { name: "Other threads" }));
        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);
    });

    it("should not show participated threads in Other threads tab", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithNotif, roomWithOtherThread]);
        renderTAC();
        await userEvent.click(getTACButton());

        // "My threads" tab should show the participated thread
        expect(screen.getAllByRole("menuitem").length).toEqual(1);

        // "Other threads" tab should only show the non-participated thread
        await userEvent.click(screen.getByRole("tab", { name: "Other threads" }));
        const otherRows = screen.getAllByRole("menuitem");
        expect(otherRows.length).toEqual(1);
    });

    it("should display a caption when no threads are unread", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([]);
        renderTAC();
        await userEvent.click(getTACButton());

        expect(screen.getByRole("menu").getElementsByClassName("mx_ThreadsActivityCentre_emptyCaption").length).toEqual(
            1,
        );
    });

    it("should block Ctrl/CMD + k shortcut", async () => {
        cli.getVisibleRooms = vi.fn().mockReturnValue([roomWithHighlight]);

        const keyDownHandler = vi.fn();
        render(
            <div
                onKeyDown={(evt) => {
                    keyDownHandler(evt.key, evt.ctrlKey);
                }}
            >
                <MatrixClientContext.Provider value={cli}>
                    <ThreadsActivityCentre />
                </MatrixClientContext.Provider>
            </div>,
        );
        await userEvent.click(getTACButton());

        // CTRL/CMD + k should be blocked
        await userEvent.keyboard("{Control>}k{/Control}");
        expect(keyDownHandler).not.toHaveBeenCalledWith("k", true);

        // Sanity test
        await userEvent.keyboard("{Control>}a{/Control}");
        expect(keyDownHandler).toHaveBeenCalledWith("a", true);
    });
});

describe("threadDecorationProps", () => {
    it("maps a highlight to a mention", () => {
        expect(threadDecorationProps(NotificationLevel.Highlight, 2, false)).toEqual(
            expect.objectContaining({
                isMention: true,
                isNotification: false,
                isActivityNotification: false,
                count: 2,
                hasUnreadCount: true,
                muted: false,
            }),
        );
    });

    it("maps a notification to a counter", () => {
        expect(threadDecorationProps(NotificationLevel.Notification, 5, false)).toEqual(
            expect.objectContaining({
                isMention: false,
                isNotification: true,
                isActivityNotification: false,
                count: 5,
                hasUnreadCount: true,
            }),
        );
    });

    it("maps a local-only unread to activity, with no count", () => {
        expect(threadDecorationProps(NotificationLevel.Activity, 0, false)).toEqual(
            expect.objectContaining({
                isMention: false,
                isNotification: false,
                isActivityNotification: true,
                count: 0,
                hasUnreadCount: false,
            }),
        );
    });

    it("passes the muted flag through", () => {
        expect(threadDecorationProps(NotificationLevel.Activity, 0, true).muted).toBe(true);
    });

    it("never reports a thread as unsent or invited", () => {
        const props = threadDecorationProps(NotificationLevel.Highlight, 1, false);
        expect(props.isUnsentMessage).toBe(false);
        expect(props.invited).toBe(false);
        // Rows only exist for unread threads, so the decoration always renders
        expect(props.hasAnyNotificationOrActivity).toBe(true);
    });
});
