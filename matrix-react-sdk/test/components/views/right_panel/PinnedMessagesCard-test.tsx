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
import { render, act, RenderResult, fireEvent, waitForElementToBeRemoved, screen } from "@testing-library/react";
import { mocked } from "jest-mock";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType, RelationType, MsgType } from "matrix-js-sdk/src/@types/event";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { IEvent, Room, EventTimelineSet, IMinimalEvent } from "matrix-js-sdk/src/matrix";
import { M_POLL_KIND_DISCLOSED } from "matrix-js-sdk/src/@types/polls";
import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { PollResponseEvent } from "matrix-js-sdk/src/extensible_events_v1/PollResponseEvent";
import { PollEndEvent } from "matrix-js-sdk/src/extensible_events_v1/PollEndEvent";

import { stubClient, mkEvent, mkMessage, flushPromises } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import PinnedMessagesCard from "../../../../src/components/views/right_panel/PinnedMessagesCard";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";

describe("<PinnedMessagesCard />", () => {
    stubClient();
    const cli = mocked(MatrixClientPeg.safeGet());
    cli.getUserId.mockReturnValue("@alice:example.org");
    cli.setRoomAccountData.mockResolvedValue({});
    cli.relations.mockResolvedValue({ originalEvent: {} as unknown as MatrixEvent, events: [] });

    const mkRoom = (localPins: MatrixEvent[], nonLocalPins: MatrixEvent[]): Room => {
        const room = new Room("!room:example.org", cli, "@me:example.org");
        // Deferred since we may be adding or removing pins later
        const pins = () => [...localPins, ...nonLocalPins];

        // Insert pin IDs into room state
        jest.spyOn(room.currentState, "getStateEvents").mockImplementation((): any =>
            mkEvent({
                event: true,
                type: EventType.RoomPinnedEvents,
                content: {
                    pinned: pins().map((e) => e.getId()),
                },
                user: "@user:example.org",
                room: "!room:example.org",
            }),
        );

        jest.spyOn(room.currentState, "on");

        // Insert local pins into local timeline set
        room.getUnfilteredTimelineSet = () =>
            ({
                getTimelineForEvent: () => ({
                    getEvents: () => localPins,
                }),
            } as unknown as EventTimelineSet);

        // Return all pins over fetchRoomEvent
        cli.fetchRoomEvent.mockImplementation((roomId, eventId) => {
            const event = pins().find((e) => e.getId() === eventId)?.event;
            return Promise.resolve(event as IMinimalEvent);
        });

        cli.getRoom.mockReturnValue(room);

        return room;
    };

    const mountPins = async (room: Room): Promise<RenderResult> => {
        let pins!: RenderResult;
        await act(async () => {
            pins = render(
                <MatrixClientContext.Provider value={cli}>
                    <PinnedMessagesCard
                        room={room}
                        onClose={jest.fn()}
                        permalinkCreator={new RoomPermalinkCreator(room, room.roomId)}
                    />
                </MatrixClientContext.Provider>,
            );
            // Wait a tick for state updates
            await new Promise((resolve) => setImmediate(resolve));
        });

        return pins;
    };

    const emitPinUpdates = async (room: Room) => {
        const pinListener = mocked(room.currentState).on.mock.calls.find(
            ([eventName, listener]) => eventName === RoomStateEvent.Events,
        )![1];

        await act(async () => {
            // Emit the update
            // @ts-ignore what is going on here?
            pinListener(room.currentState.getStateEvents());
            // Wait a tick for state updates
            await new Promise((resolve) => setImmediate(resolve));
        });
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
        const localPins: MatrixEvent[] = [];
        const nonLocalPins: MatrixEvent[] = [];
        const room = mkRoom(localPins, nonLocalPins);
        const pins = await mountPins(room);
        expect(pins.container.querySelectorAll(".mx_PinnedEventTile")).toHaveLength(0);

        // Pin the first message
        localPins.push(pin1);
        await emitPinUpdates(room);
        expect(pins.container.querySelectorAll(".mx_PinnedEventTile")).toHaveLength(1);

        // Pin the second message
        nonLocalPins.push(pin2);
        await emitPinUpdates(room);
        expect(pins.container.querySelectorAll(".mx_PinnedEventTile")).toHaveLength(2);
    });

    it("updates when messages are unpinned", async () => {
        // Start with two pins
        const localPins = [pin1];
        const nonLocalPins = [pin2];
        const room = mkRoom(localPins, nonLocalPins);
        const pins = await mountPins(room);
        expect(pins.container.querySelectorAll(".mx_PinnedEventTile")).toHaveLength(2);

        // Unpin the first message
        localPins.pop();
        await emitPinUpdates(room);
        expect(pins.container.querySelectorAll(".mx_PinnedEventTile")).toHaveLength(1);

        // Unpin the second message
        nonLocalPins.pop();
        await emitPinUpdates(room);
        expect(pins.container.querySelectorAll(".mx_PinnedEventTile")).toHaveLength(0);
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
        expect(pins.container.querySelectorAll(".mx_PinnedEventTile")).toHaveLength(0);
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
        expect(pins.container.querySelectorAll(".mx_PinnedEventTile")).toHaveLength(0);
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
        const pinTile = pins.container.querySelectorAll(".mx_PinnedEventTile");
        expect(pinTile.length).toBe(1);
        expect(pinTile[0].querySelector(".mx_EventTile_body")!).toHaveTextContent("First pinned message, edited");
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
            ["@alice:example.org", 0] as [string, number],
            ["@bob:example.org", 0] as [string, number],
            ["@eve:example.org", 1] as [string, number],
        ].map(([user, option], i) =>
            mkEvent({
                ...PollResponseEvent.from([answers[option as number].id], poll.getId()!).serialize(),
                event: true,
                room: "!room:example.org",
                user,
            }),
        );

        const end = mkEvent({
            ...PollEndEvent.from(poll.getId()!, "Closing the poll").serialize(),
            event: true,
            room: "!room:example.org",
            user: "@alice:example.org",
        });

        // Make the responses available
        cli.relations.mockImplementation(async (roomId, eventId, relationType, eventType, opts) => {
            if (eventId === poll.getId() && relationType === RelationType.Reference) {
                // Paginate the results, for added challenge
                return opts?.from === "page2"
                    ? { originalEvent: poll, events: responses.slice(2) }
                    : { originalEvent: poll, events: [...responses.slice(0, 2), end], nextBatch: "page2" };
            }
            // type does not allow originalEvent to be falsy
            // but code seems to
            // so still test that
            return { originalEvent: undefined as unknown as MatrixEvent, events: [] };
        });

        const room = mkRoom([], [poll]);
        // poll end event validates against this
        jest.spyOn(room.currentState, "maySendRedactionForEvent").mockReturnValue(true);

        const pins = await mountPins(room);
        // two pages of results
        await flushPromises();
        await flushPromises();

        const pollInstance = room.polls.get(poll.getId()!);
        expect(pollInstance).toBeTruthy();

        const pinTile = pins.container.querySelectorAll(".mx_MPollBody");

        expect(pinTile).toHaveLength(1);
        expect(pinTile[0].querySelectorAll(".mx_PollOption_ended")).toHaveLength(2);
        expect(pinTile[0].querySelectorAll(".mx_PollOption_optionVoteCount")[0]).toHaveTextContent("2 votes");
        expect([...pinTile[0].querySelectorAll(".mx_PollOption_optionVoteCount")].at(-1)).toHaveTextContent("1 vote");
    });

    it("should allow admins to unpin messages", async () => {
        const nonLocalPins = [pin1];
        const room = mkRoom([], nonLocalPins);
        jest.spyOn(room.currentState, "mayClientSendStateEvent").mockReturnValue(true);
        const sendStateEvent = jest.spyOn(cli, "sendStateEvent");

        const pins = await mountPins(room);
        const pinTile = pins.container.querySelectorAll(".mx_PinnedEventTile");
        expect(pinTile).toHaveLength(1);

        fireEvent.click(pinTile[0].querySelector(".mx_PinnedEventTile_unpinButton")!);
        expect(sendStateEvent).toHaveBeenCalledWith(room.roomId, "m.room.pinned_events", { pinned: [] }, "");

        nonLocalPins.pop();
        await Promise.all([waitForElementToBeRemoved(pinTile[0]), emitPinUpdates(room)]);
    });

    it("should show spinner whilst loading", async () => {
        const room = mkRoom([], [pin1]);
        mountPins(room);
        const spinner = await screen.findByTestId("spinner");
        await waitForElementToBeRemoved(spinner);
    });
});
