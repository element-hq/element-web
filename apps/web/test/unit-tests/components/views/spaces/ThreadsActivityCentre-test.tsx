/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps } from "react";
import { render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { NotificationCountType, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";

import { ThreadsActivityCentre } from "../../../../../src/components/views/spaces/threads-activity-centre";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { stubClient } from "../../../../test-utils";
import { populateThread } from "../../../../test-utils/threads";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";

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

    const getDefaultThreadArgs = (room: Room) => ({
        room: room,
        client: cli,
        authorId: userId,
        participantUserIds: ["@fee:bar"],
    });

    beforeAll(async () => {
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(cli);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(cli);

        const dmRoomMap = new DMRoomMap(cli);
        jest.spyOn(dmRoomMap, "getUserIdForRoomId");
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);

        // Thread where current user participated (notification level)
        const notifThreadInfo = await populateThread(getDefaultThreadArgs(roomWithNotif));
        roomWithNotif.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 1);
        // Mock the server-provided participation flag (processRootEvent is async)
        jest.spyOn(notifThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(true);

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
        jest.spyOn(highlightThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(true);

        // Thread by another user, no participation (notification level → Other threads)
        const otherThreadInfo = await populateThread({
            room: roomWithOtherThread,
            client: cli,
            authorId: "@other:bar",
            participantUserIds: ["@someone:bar"],
        });
        roomWithOtherThread.setThreadUnreadNotificationCount(
            otherThreadInfo.thread.id,
            NotificationCountType.Total,
            1,
        );
        jest.spyOn(otherThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(false);

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
        jest.spyOn(highlightOtherThreadInfo.thread, "hasCurrentUserParticipated", "get").mockReturnValue(false);
    });

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
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithNotif]);
        renderTAC();
        await userEvent.click(getTACButton());

        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);
    });

    it("should render a participated thread with notification in My threads", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithNotif]);
        renderTAC();
        await userEvent.click(getTACButton());

        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);
        expect(tacRows[0].getElementsByClassName("mx_NotificationBadge_level_notification").length).toEqual(1);
    });

    it("should render a participated thread with highlight in My threads", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithHighlight]);
        renderTAC();
        await userEvent.click(getTACButton());

        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);
        expect(tacRows[0].getElementsByClassName("mx_NotificationBadge_level_highlight").length).toEqual(1);
    });

    it("should show a highlighted thread by another user in My threads (keyword/mention)", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithHighlightOtherAuthor]);
        renderTAC();
        await userEvent.click(getTACButton());

        // Even though the user didn't participate, highlight > 0 makes it relevant → My threads
        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);
        expect(tacRows[0].getElementsByClassName("mx_NotificationBadge_level_highlight").length).toEqual(1);
    });

    it("should show other threads in the Other threads tab", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithOtherThread]);
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
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithNotif, roomWithOtherThread]);
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
        cli.getVisibleRooms = jest.fn().mockReturnValue([]);
        renderTAC();
        await userEvent.click(getTACButton());

        expect(screen.getByRole("menu").getElementsByClassName("mx_ThreadsActivityCentre_emptyCaption").length).toEqual(
            1,
        );
    });

    it("should block Ctrl/CMD + k shortcut", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithHighlight]);

        const keyDownHandler = jest.fn();
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
