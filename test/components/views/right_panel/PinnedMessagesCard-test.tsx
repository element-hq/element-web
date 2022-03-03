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
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType, RelationType, MsgType } from "matrix-js-sdk/src/@types/event";

import "../../../skinned-sdk";
import {
    stubClient,
    wrapInMatrixClientContext,
    mkStubRoom,
    mkEvent,
    mkMessage,
} from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import _PinnedMessagesCard from "../../../../src/components/views/right_panel/PinnedMessagesCard";
import PinnedEventTile from "../../../../src/components/views/rooms/PinnedEventTile";

describe("<PinnedMessagesCard />", () => {
    stubClient();
    const cli = MatrixClientPeg.get();
    cli.setRoomAccountData = () => {};
    cli.relations = jest.fn().mockResolvedValue({ events: [] });
    const PinnedMessagesCard = wrapInMatrixClientContext(_PinnedMessagesCard);

    const mkRoom = (localPins: MatrixEvent[], nonLocalPins: MatrixEvent[]) => {
        const pins = [...localPins, ...nonLocalPins];
        const room = mkStubRoom("!room:example.org");

        // Insert pin IDs into room state
        const pinState = mkEvent({
            event: true,
            type: EventType.RoomPinnedEvents,
            content: {
                pinned: pins.map(e => e.getId()),
            },
        });
        room.currentState.getStateEvents.mockReturnValue(pinState);

        // Insert local pins into local timeline set
        room.getUnfilteredTimelineSet = () => ({
            getTimelineForEvent: () => ({
                getEvents: () => localPins,
            }),
        });

        // Return all pins over fetchRoomEvent
        cli.fetchRoomEvent = (roomId, eventId) => pins.find(e => e.getId() === eventId)?.event;

        return room;
    };

    it("hides unpinnable events found in local timeline", async () => {
        // Redacted messages are unpinnable
        const pin = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            content: {},
            unsigned: { redacted_because: {} },
        });

        let pins;
        await act(async () => {
            pins = mount(<PinnedMessagesCard room={mkRoom([pin], [])} onClose={() => {}} />);
            // Wait a tick for state updates
            await new Promise(resolve => setImmediate(resolve));
        });
        pins.update();
        expect(pins.find(PinnedEventTile).length).toBe(0);
    });

    it("hides unpinnable events not found in local timeline", async () => {
        // Redacted messages are unpinnable
        const pin = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            content: {},
            unsigned: { redacted_because: {} },
        });

        let pins;
        await act(async () => {
            pins = mount(<PinnedMessagesCard room={mkRoom([], [pin])} onClose={() => {}} />);
            // Wait a tick for state updates
            await new Promise(resolve => setImmediate(resolve));
        });
        pins.update();
        expect(pins.find(PinnedEventTile).length).toBe(0);
    });

    it("accounts for edits", async () => {
        const pin = mkMessage({
            event: true,
            room: "!room:example.org",
            user: "@alice:example.org",
            msg: "Hello!",
        });
        cli.relations.mockResolvedValue({
            events: [mkEvent({
                event: true,
                type: EventType.RoomMessage,
                room: "!room:example.org",
                user: "@alice:example.org",
                content: {
                    "msgtype": MsgType.Text,
                    "body": " * Hello again!",
                    "m.new_content": {
                        msgtype: MsgType.Text,
                        body: "Hello again!",
                    },
                    "m.relates_to": {
                        rel_type: RelationType.Replace,
                        event_id: pin.getId(),
                    },
                },
            })],
        });

        let pins;
        await act(async () => {
            pins = mount(<PinnedMessagesCard room={mkRoom([], [pin])} onClose={() => {}} />);
            // Wait a tick for state updates
            await new Promise(resolve => setImmediate(resolve));
        });
        pins.update();

        const pinTile = pins.find(PinnedEventTile);
        expect(pinTile.length).toBe(1);
        expect(pinTile.find(".mx_EventTile_body").text()).toEqual("Hello again!");
    });
});
