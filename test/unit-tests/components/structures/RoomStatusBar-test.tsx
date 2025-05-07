/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import {
    type MatrixClient,
    PendingEventOrdering,
    EventStatus,
    type MatrixEvent,
    Room,
    MatrixError,
} from "matrix-js-sdk/src/matrix";

import RoomStatusBar, { getUnsentMessages } from "../../../../src/components/structures/RoomStatusBar";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { mkEvent, stubClient } from "../../../test-utils/test-utils";
import { mkThread } from "../../../test-utils/threads";

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
