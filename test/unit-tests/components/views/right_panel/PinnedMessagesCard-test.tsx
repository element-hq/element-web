/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, act, type RenderResult, waitForElementToBeRemoved, screen, waitFor } from "jest-matrix-react";
import { mocked, type MockedObject } from "jest-mock";
import {
    MatrixEvent,
    RoomStateEvent,
    Room,
    type IMinimalEvent,
    EventType,
    RelationType,
    MsgType,
    M_POLL_KIND_DISCLOSED,
    EventTimeline,
    type MatrixClient,
} from "matrix-js-sdk/src/matrix";
import { PollStartEvent } from "matrix-js-sdk/src/extensible_events_v1/PollStartEvent";
import { PollResponseEvent } from "matrix-js-sdk/src/extensible_events_v1/PollResponseEvent";
import { PollEndEvent } from "matrix-js-sdk/src/extensible_events_v1/PollEndEvent";
import { sleep } from "matrix-js-sdk/src/utils";
import userEvent from "@testing-library/user-event";

import { stubClient, mkEvent, mkMessage, flushPromises } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { PinnedMessagesCard } from "../../../../../src/components/views/right_panel/PinnedMessagesCard";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import Modal from "../../../../../src/Modal";
import { UnpinAllDialog } from "../../../../../src/components/views/dialogs/UnpinAllDialog";

describe("<PinnedMessagesCard />", () => {
    let cli: MockedObject<MatrixClient>;
    beforeEach(() => {
        stubClient();
        cli = mocked(MatrixClientPeg.safeGet());
        cli.getUserId.mockReturnValue("@alice:example.org");
        cli.setRoomAccountData.mockResolvedValue({});
        cli.relations.mockResolvedValue({ originalEvent: {} as unknown as MatrixEvent, events: [] });
    });

    const mkRoom = (localPins: MatrixEvent[], nonLocalPins: MatrixEvent[]): Room => {
        const room = new Room("!room:example.org", cli, "@me:example.org");
        // Deferred since we may be adding or removing pins later
        const pins = () => [...localPins, ...nonLocalPins];

        // Insert pin IDs into room state
        jest.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "getStateEvents").mockImplementation(
            (): any =>
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

        jest.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "mayClientSendStateEvent").mockReturnValue(
            true,
        );
        // poll end event validates against this
        jest.spyOn(
            room.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
            "maySendRedactionForEvent",
        ).mockReturnValue(true);

        // Return all pins over fetchRoomEvent
        cli.fetchRoomEvent.mockImplementation((roomId, eventId) => {
            const event = pins().find((e) => e.getId() === eventId)?.event;
            return Promise.resolve(event as IMinimalEvent);
        });

        cli.getRoom.mockReturnValue(room);

        return room;
    };

    async function renderMessagePinList(room: Room): Promise<RenderResult> {
        const renderResult = render(
            <MatrixClientContext.Provider value={cli}>
                <PinnedMessagesCard
                    room={room}
                    onClose={jest.fn()}
                    permalinkCreator={new RoomPermalinkCreator(room, room.roomId)}
                />
            </MatrixClientContext.Provider>,
        );
        // Wait a tick for state updates
        await act(() => sleep(0));

        return renderResult;
    }

    /**
     *
     * @param room
     */
    async function emitPinUpdate(room: Room) {
        await act(async () => {
            const roomState = room.getLiveTimeline().getState(EventTimeline.FORWARDS)!;
            roomState.emit(
                RoomStateEvent.Events,
                new MatrixEvent({ type: EventType.RoomPinnedEvents }),
                roomState,
                null,
            );
        });
    }

    /**
     * Initialize the pinned messages card with the given pinned messages.
     * Return the room, testing library helpers and functions to add and remove pinned messages.
     * @param localPins
     * @param nonLocalPins
     */
    async function initPinnedMessagesCard(localPins: MatrixEvent[], nonLocalPins: MatrixEvent[]) {
        const room = mkRoom(localPins, nonLocalPins);
        const addLocalPinEvent = async (event: MatrixEvent) => {
            localPins.push(event);
            await emitPinUpdate(room);
        };
        const removeLastLocalPinEvent = async () => {
            localPins.pop();
            await emitPinUpdate(room);
        };
        const addNonLocalPinEvent = async (event: MatrixEvent) => {
            nonLocalPins.push(event);
            await emitPinUpdate(room);
        };
        const removeLastNonLocalPinEvent = async () => {
            nonLocalPins.pop();
            await emitPinUpdate(room);
        };
        const renderResult = await renderMessagePinList(room);

        return {
            ...renderResult,
            addLocalPinEvent,
            removeLastLocalPinEvent,
            addNonLocalPinEvent,
            removeLastNonLocalPinEvent,
            room,
        };
    }

    const pin1 = mkMessage({
        event: true,
        room: "!room:example.org",
        user: "@alice:example.org",
        msg: "First pinned message",
        ts: 2,
    });
    const pin2 = mkMessage({
        event: true,
        room: "!room:example.org",
        user: "@alice:example.org",
        msg: "The second one",
        ts: 1,
    });

    it("should show spinner whilst loading", async () => {
        const room = mkRoom([], [pin1]);
        render(
            <MatrixClientContext.Provider value={cli}>
                <PinnedMessagesCard
                    room={room}
                    onClose={jest.fn()}
                    permalinkCreator={new RoomPermalinkCreator(room, room.roomId)}
                />
            </MatrixClientContext.Provider>,
        );

        await waitForElementToBeRemoved(() => screen.queryAllByRole("progressbar"));
    });

    it("should show the empty state when there are no pins", async () => {
        const { asFragment } = await initPinnedMessagesCard([], []);

        expect(screen.getByText("Pin important messages so that they can be easily discovered")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should show two pinned messages", async () => {
        const { asFragment } = await initPinnedMessagesCard([pin1], [pin2]);

        await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(2));
        expect(asFragment()).toMatchSnapshot();
    });

    it("should not show more than 100 messages", async () => {
        const events = Array.from({ length: 120 }, (_, i) =>
            mkMessage({
                event: true,
                room: "!room:example.org",
                user: "@alice:example.org",
                msg: `The message ${i}`,
                ts: i,
            }),
        );
        await initPinnedMessagesCard(events, []);

        await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(100));
    }, 15000);

    it("should updates when messages are pinned", async () => {
        // Start with nothing pinned
        const { addLocalPinEvent, addNonLocalPinEvent } = await initPinnedMessagesCard([], []);

        await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(0));

        // Pin the first message
        await addLocalPinEvent(pin1);
        await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(1));

        // Pin the second message
        await addNonLocalPinEvent(pin2);
        await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(2));
    });

    it("should updates when messages are unpinned", async () => {
        // Start with two pins
        const { removeLastLocalPinEvent, removeLastNonLocalPinEvent } = await initPinnedMessagesCard([pin1], [pin2]);
        await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(2));

        // Unpin the first message
        await removeLastLocalPinEvent();
        await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(1));

        // Unpin the second message
        await removeLastNonLocalPinEvent();
        await waitFor(() => expect(screen.queryAllByRole("listitem")).toHaveLength(0));
    });

    it("should display an edited pinned event", async () => {
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

        await initPinnedMessagesCard([], [pin1]);
        expect(screen.getByText("First pinned message, edited")).toBeInTheDocument();
    });

    describe("unpinnable event", () => {
        it("should hide unpinnable events found in local timeline", async () => {
            // Redacted messages are unpinnable
            const pin = mkEvent({
                event: true,
                type: EventType.RoomCreate,
                content: {},
                room: "!room:example.org",
                user: "@alice:example.org",
            });
            await initPinnedMessagesCard([pin], []);
            expect(screen.queryAllByRole("listitem")).toHaveLength(0);
        });

        it("hides unpinnable events not found in local timeline", async () => {
            // Redacted messages are unpinnable
            const pin = mkEvent({
                event: true,
                type: EventType.RoomCreate,
                content: {},
                room: "!room:example.org",
                user: "@alice:example.org",
            });
            await initPinnedMessagesCard([], [pin]);
            expect(screen.queryAllByRole("listitem")).toHaveLength(0);
        });
    });

    describe("unpin all", () => {
        it("should not allow to unpinall", async () => {
            const room = mkRoom([pin1], [pin2]);
            jest.spyOn(
                room.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "mayClientSendStateEvent",
            ).mockReturnValue(false);

            const { asFragment } = render(
                <MatrixClientContext.Provider value={cli}>
                    <PinnedMessagesCard
                        room={room}
                        onClose={jest.fn()}
                        permalinkCreator={new RoomPermalinkCreator(room, room.roomId)}
                    />
                </MatrixClientContext.Provider>,
            );

            // Wait a tick for state updates
            await act(() => sleep(0));

            expect(screen.queryByText("Unpin all messages")).toBeNull();
            expect(asFragment()).toMatchSnapshot();
        });

        it("should allow unpinning all messages", async () => {
            jest.spyOn(Modal, "createDialog");

            const { room } = await initPinnedMessagesCard([pin1], [pin2]);
            expect(screen.getByText("Unpin all messages")).toBeInTheDocument();

            await userEvent.click(screen.getByText("Unpin all messages"));
            // Should open the UnpinAllDialog dialog
            expect(Modal.createDialog).toHaveBeenCalledWith(UnpinAllDialog, { roomId: room.roomId, matrixClient: cli });
        });
    });

    it("should displays votes on polls not found in local timeline", async () => {
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

        const { room } = await initPinnedMessagesCard([], [poll]);

        // two pages of results
        await flushPromises();
        await flushPromises();

        const pollInstance = room.polls.get(poll.getId()!);
        expect(pollInstance).toBeTruthy();

        expect(screen.getByText("A poll")).toBeInTheDocument();

        expect(screen.getByText("Option 1")).toBeInTheDocument();
        expect(screen.getByText("2 votes")).toBeInTheDocument();

        expect(screen.getByText("Option 2")).toBeInTheDocument();
        expect(screen.getByText("1 vote")).toBeInTheDocument();
    });
});
