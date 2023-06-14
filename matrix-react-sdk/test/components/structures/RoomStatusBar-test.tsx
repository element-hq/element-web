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
import { render } from "@testing-library/react";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { EventStatus, MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixError } from "matrix-js-sdk/src/http-api";

import RoomStatusBar, { getUnsentMessages } from "../../../src/components/structures/RoomStatusBar";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { mkEvent, stubClient } from "../../test-utils/test-utils";
import { mkThread } from "../../test-utils/threads";

describe("RoomStatusBar", () => {
    const ROOM_ID = "!roomId:example.org";
    let room: Room;
    let client: MatrixClient;
    let event: MatrixEvent;

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.safeGet();
        client.getSyncStateData = jest.fn().mockReturnValue({});
        room = new Room(ROOM_ID, client, client.getUserId()!, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        event = mkEvent({
            event: true,
            type: "m.room.message",
            user: "@user1:server",
            room: "!room1:server",
            content: {},
        });
        event.status = EventStatus.NOT_SENT;
    });

    const getComponent = () =>
        render(<RoomStatusBar room={room} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={client}>{children}</MatrixClientContext.Provider>
            ),
        });

    describe("getUnsentMessages", () => {
        it("returns no unsent messages", () => {
            expect(getUnsentMessages(room)).toHaveLength(0);
        });

        it("checks the event status", () => {
            room.addPendingEvent(event, "123");

            expect(getUnsentMessages(room)).toHaveLength(1);
            event.status = EventStatus.SENT;

            expect(getUnsentMessages(room)).toHaveLength(0);
        });

        it("only returns events related to a thread", () => {
            room.addPendingEvent(event, "123");

            const { rootEvent, events } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@alice:example.org"],
                length: 2,
            });
            rootEvent.status = EventStatus.NOT_SENT;
            room.addPendingEvent(rootEvent, rootEvent.getId()!);
            for (const event of events) {
                event.status = EventStatus.NOT_SENT;
                room.addPendingEvent(event, Date.now() + Math.random() + "");
            }

            const pendingEvents = getUnsentMessages(room, rootEvent.getId());

            expect(pendingEvents[0].threadRootId).toBe(rootEvent.getId());
            expect(pendingEvents[1].threadRootId).toBe(rootEvent.getId());
            expect(pendingEvents[2].threadRootId).toBe(rootEvent.getId());

            // Filters out the non thread events
            expect(pendingEvents.every((ev) => ev.getId() !== event.getId())).toBe(true);
        });
    });

    describe("<RoomStatusBar />", () => {
        it("should render nothing when room has no error or unsent messages", () => {
            const { container } = getComponent();
            expect(container.firstChild).toBe(null);
        });

        describe("unsent messages", () => {
            it("should render warning when messages are unsent due to consent", () => {
                const unsentMessage = mkEvent({
                    event: true,
                    type: "m.room.message",
                    user: "@user1:server",
                    room: "!room1:server",
                    content: {},
                });
                unsentMessage.status = EventStatus.NOT_SENT;
                unsentMessage.error = new MatrixError({
                    errcode: "M_CONSENT_NOT_GIVEN",
                    data: { consent_uri: "terms.com" },
                });

                room.addPendingEvent(unsentMessage, "123");

                const { container } = getComponent();

                expect(container).toMatchSnapshot();
            });

            it("should render warning when messages are unsent due to resource limit", () => {
                const unsentMessage = mkEvent({
                    event: true,
                    type: "m.room.message",
                    user: "@user1:server",
                    room: "!room1:server",
                    content: {},
                });
                unsentMessage.status = EventStatus.NOT_SENT;
                unsentMessage.error = new MatrixError({
                    errcode: "M_RESOURCE_LIMIT_EXCEEDED",
                    data: { limit_type: "monthly_active_user" },
                });

                room.addPendingEvent(unsentMessage, "123");

                const { container } = getComponent();

                expect(container).toMatchSnapshot();
            });
        });
    });
});
