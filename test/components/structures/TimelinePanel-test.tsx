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

import React from 'react';
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";
import { EventTimeline } from "matrix-js-sdk/src/models/event-timeline";
import { MessageEvent } from 'matrix-events-sdk';
import {
    EventTimelineSet,
    EventType,
    MatrixEvent,
    PendingEventOrdering,
    Room,
} from 'matrix-js-sdk/src/matrix';
import { ReceiptType } from "matrix-js-sdk/src/@types/read_receipts";
import { render, RenderResult } from "@testing-library/react";

import { mkRoom, stubClient } from "../../test-utils";
import TimelinePanel from '../../../src/components/structures/TimelinePanel';
import { MatrixClientPeg } from '../../../src/MatrixClientPeg';
import SettingsStore from "../../../src/settings/SettingsStore";

const newReceipt = (eventId: string, userId: string, readTs: number, fullyReadTs: number): MatrixEvent => {
    const receiptContent = {
        [eventId]: {
            [ReceiptType.Read]: { [userId]: { ts: readTs } },
            [ReceiptType.ReadPrivate]: { [userId]: { ts: readTs } },
            [ReceiptType.FullyRead]: { [userId]: { ts: fullyReadTs } },
        },
    };
    return new MatrixEvent({ content: receiptContent, type: "m.receipt" });
};

const renderPanel = (room: Room, events: MatrixEvent[]): RenderResult => {
    const timelineSet = { room: room as Room } as EventTimelineSet;
    const timeline = new EventTimeline(timelineSet);
    events.forEach((event) => timeline.addEvent(event, true));
    timelineSet.getLiveTimeline = () => timeline;
    timelineSet.getTimelineForEvent = () => timeline;
    timelineSet.getPendingEvents = () => events;
    timelineSet.room.getEventReadUpTo = () => events[1].getId();

    return render(
        <TimelinePanel
            timelineSet={timelineSet}
            manageReadReceipts
            sendReadReceiptOnLoad
        />,
    );
};

const mockEvents = (room: Room, count = 2): MatrixEvent[] => {
    const events = [];
    for (let index = 0; index < count; index++) {
        events.push(new MatrixEvent({
            room_id: room.roomId,
            event_id: `event_${index}`,
            type: EventType.RoomMessage,
            user_id: "userId",
            content: MessageEvent.from(`Event${index}`).serialize().content,
        }));
    }

    return events;
};

describe('TimelinePanel', () => {
    beforeEach(() => {
        stubClient();
    });

    describe('read receipts and markers', () => {
        it('should forget the read marker when asked to', () => {
            const cli = MatrixClientPeg.get();
            const readMarkersSent = [];

            // Track calls to setRoomReadMarkers
            cli.setRoomReadMarkers = (_roomId, rmEventId, _a, _b) => {
                readMarkersSent.push(rmEventId);
                return Promise.resolve({});
            };

            const ev0 = new MatrixEvent({
                event_id: "ev0",
                sender: "@u2:m.org",
                origin_server_ts: 111,
                ...MessageEvent.from("hello 1").serialize(),
            });
            const ev1 = new MatrixEvent({
                event_id: "ev1",
                sender: "@u2:m.org",
                origin_server_ts: 222,
                ...MessageEvent.from("hello 2").serialize(),
            });

            const roomId = "#room:example.com";
            const userId = cli.credentials.userId;
            const room = new Room(
                roomId,
                cli,
                userId,
                { pendingEventOrdering: PendingEventOrdering.Detached },
            );

            // Create a TimelinePanel with ev0 already present
            const timelineSet = new EventTimelineSet(room, {});
            timelineSet.addLiveEvent(ev0);
            const component: ReactWrapper<TimelinePanel> = mount(<TimelinePanel
                timelineSet={timelineSet}
                manageReadMarkers={true}
                manageReadReceipts={true}
                eventId={ev0.getId()}
            />);
            const timelinePanel = component.instance() as TimelinePanel;

            // An event arrived, and we read it
            timelineSet.addLiveEvent(ev1);
            room.addEphemeralEvents([newReceipt("ev1", userId, 222, 220)]);

            // Sanity: We have not sent any read marker yet
            expect(readMarkersSent).toEqual([]);

            // This is what we are testing: forget the read marker - this should
            // update our read marker to match the latest receipt we sent
            timelinePanel.forgetReadMarker();

            // We sent off a read marker for the new event
            expect(readMarkersSent).toEqual(["ev1"]);
        });

        it("sends public read receipt when enabled", () => {
            const client = MatrixClientPeg.get();
            const room = mkRoom(client, "roomId");
            const events = mockEvents(room);

            const getValueCopy = SettingsStore.getValue;
            SettingsStore.getValue = jest.fn().mockImplementation((name: string) => {
                if (name === "sendReadReceipts") return true;
                return getValueCopy(name);
            });

            renderPanel(room, events);
            expect(client.setRoomReadMarkers).toHaveBeenCalledWith(room.roomId, null, events[0], events[0]);
        });

        it("does not send public read receipt when enabled", () => {
            const client = MatrixClientPeg.get();
            const room = mkRoom(client, "roomId");
            const events = mockEvents(room);

            const getValueCopy = SettingsStore.getValue;
            SettingsStore.getValue = jest.fn().mockImplementation((name: string) => {
                if (name === "sendReadReceipts") return false;
                return getValueCopy(name);
            });

            renderPanel(room, events);
            expect(client.setRoomReadMarkers).toHaveBeenCalledWith(room.roomId, null, null, events[0]);
        });
    });
});
