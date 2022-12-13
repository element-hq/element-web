/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { NotificationCountType, Room } from "matrix-js-sdk/src/models/room";

import EventTile, { EventTileProps } from "../../../../src/components/views/rooms/EventTile";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import RoomContext, { TimelineRenderingType } from "../../../../src/contexts/RoomContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { getRoomContext, mkEvent, mkMessage, stubClient } from "../../../test-utils";
import { mkThread } from "../../../test-utils/threads";

describe("EventTile", () => {
    const ROOM_ID = "!roomId:example.org";
    let mxEvent: MatrixEvent;
    let room: Room;
    let client: MatrixClient;
    // let changeEvent: (event: MatrixEvent) => void;

    function TestEventTile(props: Partial<EventTileProps>) {
        // const [event] = useState(mxEvent);
        // Give a way for a test to update the event prop.
        // changeEvent = setEvent;

        return <EventTile mxEvent={mxEvent} {...props} />;
    }

    function getComponent(
        overrides: Partial<EventTileProps> = {},
        renderingType: TimelineRenderingType = TimelineRenderingType.Room,
    ) {
        const context = getRoomContext(room, {
            timelineRenderingType: renderingType,
        });
        return render(
            <MatrixClientContext.Provider value={client}>
                <RoomContext.Provider value={context}>
                    <TestEventTile {...overrides} />
                </RoomContext.Provider>
                ,
            </MatrixClientContext.Provider>,
        );
    }

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.get();

        room = new Room(ROOM_ID, client, client.getUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        jest.spyOn(client, "getRoom").mockReturnValue(room);
        jest.spyOn(client, "decryptEventIfNeeded").mockResolvedValue();
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name) => name === "feature_threadstable");

        mxEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Hello world!",
            event: true,
        });
    });

    describe("EventTile thread summary", () => {
        beforeEach(() => {
            jest.spyOn(client, "supportsExperimentalThreads").mockReturnValue(true);
        });

        it("removes the thread summary when thread is deleted", async () => {
            const {
                rootEvent,
                events: [, reply],
            } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@alice:example.org"],
                length: 2, // root + 1 answer
            });
            getComponent(
                {
                    mxEvent: rootEvent,
                },
                TimelineRenderingType.Room,
            );

            await waitFor(() => expect(screen.queryByTestId("thread-summary")).not.toBeNull());

            const redaction = mkEvent({
                event: true,
                type: EventType.RoomRedaction,
                user: "@alice:example.org",
                room: room.roomId,
                redacts: reply.getId(),
                content: {},
            });

            act(() => room.processThreadedEvents([redaction], false));

            await waitFor(() => expect(screen.queryByTestId("thread-summary")).toBeNull());
        });
    });

    describe("EventTile renderingType: ThreadsList", () => {
        beforeEach(() => {
            const { rootEvent } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@alice:example.org"],
            });
            mxEvent = rootEvent;
        });

        it("shows an unread notification bage", () => {
            const { container } = getComponent({}, TimelineRenderingType.ThreadsList);

            expect(container.getElementsByClassName("mx_NotificationBadge")).toHaveLength(0);

            act(() => {
                room.setThreadUnreadNotificationCount(mxEvent.getId(), NotificationCountType.Total, 3);
            });

            expect(container.getElementsByClassName("mx_NotificationBadge")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_NotificationBadge_highlighted")).toHaveLength(0);

            act(() => {
                room.setThreadUnreadNotificationCount(mxEvent.getId(), NotificationCountType.Highlight, 1);
            });

            expect(container.getElementsByClassName("mx_NotificationBadge")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_NotificationBadge_highlighted")).toHaveLength(1);
        });
    });
});
