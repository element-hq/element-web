/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import React from "react";
import { getByText, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationCountType, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";

import { ThreadsActivityCentre } from "../../../../src/components/views/spaces/threads-activity-centre";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { stubClient } from "../../../test-utils";
import { populateThread } from "../../../test-utils/threads";
import DMRoomMap from "../../../../src/utils/DMRoomMap";

describe("ThreadsActivityCentre", () => {
    const getTACButton = () => {
        return screen.getByRole("button", { name: "Threads" });
    };

    const getTACMenu = () => {
        return screen.getByRole("menu");
    };

    const renderTAC = () => {
        render(
            <MatrixClientContext.Provider value={cli}>
                <ThreadsActivityCentre />
                );
            </MatrixClientContext.Provider>,
        );
    };

    const cli = stubClient();
    cli.supportsThreads = () => true;

    const roomWithActivity = new Room("!room:server", cli, cli.getSafeUserId(), {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithActivity.name = "Just activity";

    const roomWithNotif = new Room("!room:server", cli, cli.getSafeUserId(), {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithNotif.name = "A notification";

    const roomWithHighlight = new Room("!room:server", cli, cli.getSafeUserId(), {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });
    roomWithHighlight.name = "This is a real highlight";

    beforeAll(async () => {
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(cli);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(cli);

        const dmRoomMap = new DMRoomMap(cli);
        jest.spyOn(dmRoomMap, "getUserIdForRoomId");
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);

        await populateThread({
            room: roomWithActivity,
            client: cli,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });

        const notifThreadInfo = await populateThread({
            room: roomWithNotif,
            client: cli,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        roomWithNotif.setThreadUnreadNotificationCount(notifThreadInfo.thread.id, NotificationCountType.Total, 1);

        const highlightThreadInfo = await populateThread({
            room: roomWithHighlight,
            client: cli,
            authorId: "@foo:bar",
            participantUserIds: ["@fee:bar"],
        });
        roomWithHighlight.setThreadUnreadNotificationCount(
            highlightThreadInfo.thread.id,
            NotificationCountType.Highlight,
            1,
        );
    });

    it("should render the threads activity centre button", async () => {
        renderTAC();
        expect(getTACButton()).toBeInTheDocument();
    });

    it("should render the threads activity centre menu when the button is clicked", async () => {
        renderTAC();
        await userEvent.click(getTACButton());
        expect(getTACMenu()).toBeInTheDocument();
    });

    it("should render a room with a activity in the TAC", async () => {
        cli.getVisibleRooms = jest.fn().mockReturnValue([roomWithActivity]);
        renderTAC();
        await userEvent.click(getTACButton());

        const tacRows = screen.getAllByRole("menuitem");
        expect(tacRows.length).toEqual(1);

        getByText(tacRows[0], "Just activity");
        expect(tacRows[0].getElementsByClassName("mx_NotificationBadge").length).toEqual(1);
        expect(tacRows[0].getElementsByClassName("mx_NotificationBadge_level_notification").length).toEqual(0);
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
});
