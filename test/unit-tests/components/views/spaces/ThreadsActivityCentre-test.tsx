/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps } from "react";
import { getByText, render, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { NotificationCountType, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";

import { ThreadsActivityCentre } from "../../../../../src/components/views/spaces/threads-activity-centre";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { stubClient } from "../../../../test-utils";
import { populateThread } from "../../../../test-utils/threads";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import { Features } from "../../../../../src/settings/Settings.tsx";

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

    const roomWithActivity = new Room("!room:server", cli, cli.getSafeUserId(), {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithActivity.name = "Just activity";

    const roomWithNotif = new Room("!room2:server", cli, cli.getSafeUserId(), {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithNotif.name = "A notification";

    const roomWithHighlight = new Room("!room3:server", cli, cli.getSafeUserId(), {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithHighlight.name = "This is a real highlight";

    const getDefaultThreadArgs = (room: Room) => ({
        room: room,
        client: cli,
        authorId: "@foo:bar",
        participantUserIds: ["@fee:bar"],
    });

    beforeAll(async () => {
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(cli);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(cli);

        const dmRoomMap = new DMRoomMap(cli);
        jest.spyOn(dmRoomMap, "getUserIdForRoomId");
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);

        await populateThread(getDefaultThreadArgs(roomWithActivity));

        const notifThreadInfo = await populateThread(getDefaultThreadArgs(roomWithNotif));
        roomWithNotif.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 1);

        const highlightThreadInfo = await populateThread({
            ...getDefaultThreadArgs(roomWithHighlight),
            // timestamp
            ts: 5,
        });
        roomWithHighlight.setThreadUnreadNotificationCount(
            highlightThreadInfo.thread.id,
            NotificationCountType.Highlight,
            1,
        );
    });

    beforeEach(async () => {
        await SettingsStore.setValue(Features.ReleaseAnnouncement, null, SettingLevel.DEVICE, false);
    });

    it("should render the threads activity centre button", async () => {
        renderTAC();
        expect(getTACButton()).toBeInTheDocument();
    });

    it("should render the release announcement", async () => {
        // Enable release announcement
        await SettingsStore.setValue(Features.ReleaseAnnouncement, null, SettingLevel.DEVICE, true);

        renderTAC();
        expect(document.body).toMatchSnapshot();
    });

    it("should render not display the tooltip when the release announcement is displayed", async () => {
        // Enable release announcement
        await SettingsStore.setValue(Features.ReleaseAnnouncement, null, SettingLevel.DEVICE, true);

        renderTAC();

        // The tooltip should not be displayed
        await userEvent.hover(getTACButton());
        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("should close the release announcement when the TAC button is clicked", async () => {
        // Enable release announcement
        await SettingsStore.setValue(Features.ReleaseAnnouncement, null, SettingLevel.DEVICE, true);

        renderTAC();
        await userEvent.click(getTACButton());
        expect(getTACMenu()).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
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

    it("should not render a room with a activity in the TAC", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithActivity]);
        renderTAC();
        await userEvent.click(getTACButton());

        // We should not render the room with activity
        expect(() => screen.getAllByRole("menuitem")).toThrow();
    });

    it("should render a room with a regular notification in the TAC", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithNotif]);
        renderTAC();
        await userEvent.click(getTACButton());

        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);

        getByText(tacRows[0], "A notification");
        expect(tacRows[0].getElementsByClassName("mx_NotificationBadge_level_notification").length).toEqual(1);
    });

    it("should render a room with a highlight notification in the TAC", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithHighlight]);
        renderTAC();
        await userEvent.click(getTACButton());

        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);

        getByText(tacRows[0], "This is a real highlight");
        expect(tacRows[0].getElementsByClassName("mx_NotificationBadge_level_highlight").length).toEqual(1);
    });

    it("renders notifications matching the snapshot", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithHighlight, roomWithNotif, roomWithActivity]);
        renderTAC();
        await userEvent.click(getTACButton());

        expect(screen.getByRole("menu")).toMatchSnapshot();
    });

    it("should display a caption when no threads are unread", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([]);
        renderTAC();
        await userEvent.click(getTACButton());

        expect(screen.getByRole("menu").getElementsByClassName("mx_ThreadsActivityCentre_emptyCaption").length).toEqual(
            1,
        );
    });

    it("should match snapshot when empty", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([]);
        renderTAC();
        await userEvent.click(getTACButton());

        expect(screen.getByRole("menu")).toMatchSnapshot();
    });

    it("should order the room with the same notification level by most recent", async () => {
        // Generate two new rooms with threads
        const secondRoomWithHighlight = new Room("!room4:server", cli, cli.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        secondRoomWithHighlight.name = "This is a second real highlight";

        const secondHighlightThreadInfo = await populateThread({
            ...getDefaultThreadArgs(secondRoomWithHighlight),
            // timestamp
            ts: 1,
        });
        secondRoomWithHighlight.setThreadUnreadNotificationCount(
            secondHighlightThreadInfo.thread.id,
            NotificationCountType.Highlight,
            1,
        );

        const thirdRoomWithHighlight = new Room("!room5:server", cli, cli.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        thirdRoomWithHighlight.name = "This is a third real highlight";

        const thirdHighlightThreadInfo = await populateThread({
            ...getDefaultThreadArgs(thirdRoomWithHighlight),
            // timestamp
            ts: 7,
        });
        thirdRoomWithHighlight.setThreadUnreadNotificationCount(
            thirdHighlightThreadInfo.thread.id,
            NotificationCountType.Highlight,
            1,
        );

        cli.getVisibleRooms = jest
            .fn()
            .mockReturnValue([roomWithHighlight, secondRoomWithHighlight, thirdRoomWithHighlight]);

        renderTAC();
        await userEvent.click(getTACButton());

        // The room should be ordered by the most recent thread
        // thirdHighlightThreadInfo (timestamp 7) > highlightThreadInfo (timestamp 5) > secondHighlightThreadInfo (timestamp 1)
        expect(screen.getByRole("menu")).toMatchSnapshot();
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
