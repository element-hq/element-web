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

import React, { ComponentProps } from "react";
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";
import { mocked } from "jest-mock";
import { act } from "react-dom/test-utils";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType, RelationType, MsgType } from "matrix-js-sdk/src/@types/event";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { IEvent, Room, EventTimelineSet, IMinimalEvent } from "matrix-js-sdk/src/matrix";
import {
    M_POLL_RESPONSE,
    M_POLL_END,
    M_POLL_KIND_DISCLOSED,
    PollStartEvent,
    PollResponseEvent,
    PollEndEvent,
} from "matrix-events-sdk";

import {
    stubClient,
    mkStubRoom,
    mkEvent,
    mkMessage,
} from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import PinnedMessagesCard from "../../../../src/components/views/right_panel/PinnedMessagesCard";
import PinnedEventTile from "../../../../src/components/views/rooms/PinnedEventTile";
import MPollBody from "../../../../src/components/views/messages/MPollBody";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";

describe("<PinnedMessagesCard />", () => {
    stubClient();
    const cli = mocked(MatrixClientPeg.get());
    cli.getUserId.mockReturnValue("@alice:example.org");
    cli.setRoomAccountData.mockReturnValue(undefined);
    cli.relations.mockResolvedValue({ originalEvent: {} as unknown as MatrixEvent, events: [] });

    const mkRoom = (localPins: MatrixEvent[], nonLocalPins: MatrixEvent[]): Room => {
        const room = mkStubRoom("!room:example.org", 'room', cli);
        // Deferred since we may be adding or removing pins later
        const pins = () => [...localPins, ...nonLocalPins];

        // Insert pin IDs into room state
        mocked(room.currentState).getStateEvents.mockImplementation(() => mkEvent({
            event: true,
            type: EventType.RoomPinnedEvents,
            content: {
                pinned: pins().map(e => e.getId()),
            },
            user: '@user:example.org',
            room: '!room:example.org',
        }));

        // Insert local pins into local timeline set
        room.getUnfilteredTimelineSet = () => ({
            getTimelineForEvent: () => ({
                getEvents: () => localPins,
            }),
        } as unknown as EventTimelineSet);

        // Return all pins over fetchRoomEvent
        cli.fetchRoomEvent.mockImplementation((roomId, eventId) => {
            const event = pins().find(e => e.getId() === eventId)?.event;
            return Promise.resolve(event as IMinimalEvent);
        });

        return room;
    };

    const mountPins = async (room: Room): Promise<ReactWrapper<ComponentProps<typeof PinnedMessagesCard>>> => {
        let pins;
        await act(async () => {
            pins = mount(<PinnedMessagesCard
                room={room}
                onClose={jest.fn()}
                permalinkCreator={new RoomPermalinkCreator(room, room.roomId)}
            />, {
                wrappingComponent: MatrixClientContext.Provider,
                wrappingComponentProps: { value: cli },
            });
            // Wait a tick for state updates
            await new Promise(resolve => setImmediate(resolve));
        });
        pins.update();

        return pins;
    };

    const emitPinUpdates = async (pins: ReactWrapper<ComponentProps<typeof PinnedMessagesCard>>) => {
        const room = pins.props().room;
        const pinListener = mocked(room.currentState).on.mock.calls
            .find(([eventName, listener]) => eventName === RoomStateEvent.Events)[1];

        await act(async () => {
            // Emit the update
            // @ts-ignore what is going on here?
            pinListener(room.currentState.getStateEvents());
            // Wait a tick for state updates
            await new Promise(resolve => setImmediate(resolve));
        });
        pins.update();
    };

    const pin1 = mkMessage({
        event: true,
        room: "!room:example.org",
        user: "@alice:example.org",
        msg: "First pinned message",
    });
    const pin2 = mkMessage({
        event: true,
        room: "!room:example.org",
        user: "@alice:example.org",
        msg: "The second one",
    });

    it("updates when messages are pinned", async () => {
        // Start with nothing pinned
        const localPins = [];
        const nonLocalPins = [];
        const pins = await mountPins(mkRoom(localPins, nonLocalPins));
        expect(pins.find(PinnedEventTile).length).toBe(0);

        // Pin the first message
        localPins.push(pin1);
        await emitPinUpdates(pins);
        expect(pins.find(PinnedEventTile).length).toBe(1);

        // Pin the second message
        nonLocalPins.push(pin2);
        await emitPinUpdates(pins);
        expect(pins.find(PinnedEventTile).length).toBe(2);
    });

    it("updates when messages are unpinned", async () => {
        // Start with two pins
        const localPins = [pin1];
        const nonLocalPins = [pin2];
        const pins = await mountPins(mkRoom(localPins, nonLocalPins));
        expect(pins.find(PinnedEventTile).length).toBe(2);

        // Unpin the first message
        localPins.pop();
        await emitPinUpdates(pins);
        expect(pins.find(PinnedEventTile).length).toBe(1);

        // Unpin the second message
        nonLocalPins.pop();
        await emitPinUpdates(pins);
        expect(pins.find(PinnedEventTile).length).toBe(0);
    });

    it("hides unpinnable events found in local timeline", async () => {
        // Redacted messages are unpinnable
        const pin = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            content: {},
            unsigned: { redacted_because: {} as unknown as IEvent },
            room: "!room:example.org",
            user: "@alice:example.org",
        });

        const pins = await mountPins(mkRoom([pin], []));
        expect(pins.find(PinnedEventTile).length).toBe(0);
    });

    it("hides unpinnable events not found in local timeline", async () => {
        // Redacted messages are unpinnable
        const pin = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            content: {},
            unsigned: { redacted_because: {} as unknown as IEvent },
            room: "!room:example.org",
            user: "@alice:example.org",
        });

        const pins = await mountPins(mkRoom([], [pin]));
        expect(pins.find(PinnedEventTile).length).toBe(0);
    });

    it("accounts for edits", async () => {
        const messageEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: "!room:example.org",
            user: "@alice:example.org",
            content: {
                "msgtype": MsgType.Text,
                "body": " * First pinned message, edited",
                "m.new_content": {
                    msgtype: MsgType.Text,
                    body: "First pinned message, edited",
                },
                "m.relates_to": {
                    rel_type: RelationType.Replace,
                    event_id: pin1.getId(),
                },
            },
        });
        cli.relations.mockResolvedValue({
            originalEvent: pin1,
            events: [messageEvent],
        });

        const pins = await mountPins(mkRoom([], [pin1]));
        const pinTile = pins.find(PinnedEventTile);
        expect(pinTile.length).toBe(1);
        expect(pinTile.find(".mx_EventTile_body").text()).toEqual("First pinned message, edited");
    });

    it("displays votes on polls not found in local timeline", async () => {
        const poll = mkEvent({
            ...PollStartEvent.from("A poll", ["Option 1", "Option 2"], M_POLL_KIND_DISCLOSED).serialize(),
            event: true,
            room: "!room:example.org",
            user: "@alice:example.org",
        });

        const answers = (poll.unstableExtensibleEvent as PollStartEvent).answers;
        const responses = [
            ["@alice:example.org", 0],
            ["@bob:example.org", 0],
            ["@eve:example.org", 1],
        ].map(([user, option], i) => mkEvent({
            ...PollResponseEvent.from([answers[option].id], poll.getId()).serialize(),
            event: true,
            room: "!room:example.org",
            user: user as string,
        }));
        const end = mkEvent({
            ...PollEndEvent.from(poll.getId(), "Closing the poll").serialize(),
            event: true,
            room: "!room:example.org",
            user: "@alice:example.org",
        });

        // Make the responses available
        cli.relations.mockImplementation(async (roomId, eventId, relationType, eventType, { from }) => {
            if (eventId === poll.getId() && relationType === RelationType.Reference) {
                switch (eventType) {
                    case M_POLL_RESPONSE.name:
                        // Paginate the results, for added challenge
                        return (from === "page2") ?
                            { originalEvent: poll, events: responses.slice(2) } :
                            { originalEvent: poll, events: responses.slice(0, 2), nextBatch: "page2" };
                    case M_POLL_END.name:
                        return { originalEvent: null, events: [end] };
                }
            }
            // type does not allow originalEvent to be falsy
            // but code seems to
            // so still test that
            return { originalEvent: undefined as unknown as MatrixEvent, events: [] };
        });

        const pins = await mountPins(mkRoom([], [poll]));
        const pinTile = pins.find(MPollBody);
        expect(pinTile.length).toEqual(1);
        expect(pinTile.find(".mx_MPollBody_option_ended").length).toEqual(2);
        expect(pinTile.find(".mx_MPollBody_optionVoteCount").first().text()).toEqual("2 votes");
        expect(pinTile.find(".mx_MPollBody_optionVoteCount").last().text()).toEqual("1 vote");
    });
});
