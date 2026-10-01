/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "test-utils-rtl";
import { EventTimeline, EventType, type IEvent, type MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { stubClient } from "test-utils";

import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { PinnedEventTile } from "./PinnedEventTile";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { getForwardableEvent } from "../../../events";
import { createRedactEventDialog } from "../dialogs/ConfirmRedactDialog";

vi.mock("../dialogs/ConfirmRedactDialog", () => ({
    createRedactEventDialog: vi.fn(),
}));

describe("<PinnedEventTile />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    let mockClient: MatrixClient;
    let room: Room;
    let permalinkCreator: RoomPermalinkCreator;
    beforeEach(() => {
        mockClient = stubClient();
        room = new Room(roomId, mockClient, userId);
        permalinkCreator = new RoomPermalinkCreator(room);
        mockClient.getRoom = vi.fn().mockReturnValue(room);
        vi.spyOn(dis, "dispatch").mockReturnValue(undefined);
    });

    /**
     * Create a pinned event with the given content.
     * @param content
     */
    function makePinEvent(content?: Partial<IEvent>) {
        return new MatrixEvent({
            type: EventType.RoomMessage,
            sender: userId,
            content: {
                body: "First pinned message",
                msgtype: "m.text",
            },
            room_id: roomId,
            origin_server_ts: 0,
            event_id: "$eventId",
            ...content,
        });
    }

    /**
     * Render the component with the given event.
     * @param event - pinned event
     */
    function renderComponent(event: MatrixEvent) {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <PinnedEventTile permalinkCreator={permalinkCreator} event={event} room={room} />
            </MatrixClientContext.Provider>,
        );
    }

    /**
     * Render the component and open the menu.
     */
    async function renderAndOpenMenu() {
        const pinEvent = makePinEvent();
        const renderResult = renderComponent(pinEvent);
        await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
        return { pinEvent, renderResult };
    }

    it("should throw when pinned event has no sender", () => {
        const pinEventWithoutSender = makePinEvent({ sender: undefined });
        expect(() => renderComponent(pinEventWithoutSender)).toThrow("Pinned event unexpectedly has no sender");
    });

    it("should render pinned event", () => {
        const { container } = renderComponent(makePinEvent());
        expect(container).toMatchSnapshot();
    });

    it("should render pinned event with thread info", async () => {
        const event = makePinEvent({
            content: {
                "body": "First pinned message",
                "msgtype": "m.text",
                "m.relates_to": {
                    "event_id": "$threadRootEventId",
                    "is_falling_back": true,
                    "m.in_reply_to": {
                        event_id: "$$threadRootEventId",
                    },
                    "rel_type": "m.thread",
                },
            },
        });
        const threadRootEvent = makePinEvent({ event_id: "$threadRootEventId" });
        vi.spyOn(room, "findEventById").mockReturnValue(threadRootEvent);

        const { container } = renderComponent(event);
        expect(container).toMatchSnapshot();

        await userEvent.click(screen.getByRole("button", { name: "thread message" }));
        // Check that the thread is opened
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.ShowThread,
            rootEvent: threadRootEvent,
            push: true,
        });
    });

    it("should render the menu without unpin and delete", async () => {
        vi.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "mayClientSendStateEvent").mockReturnValue(
            false,
        );
        vi.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "maySendRedactionForEvent").mockReturnValue(
            false,
        );

        await renderAndOpenMenu();

        // Unpin and delete should not be present
        await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
        expect(screen.getByRole("menuitem", { name: "View in timeline" })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: "Forward" })).toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Unpin" })).toBeNull();
        expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
        expect(screen.getByRole("menu")).toMatchSnapshot();
    });

    it("should render the menu with all the options", async () => {
        // Enable unpin
        vi.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "mayClientSendStateEvent").mockReturnValue(
            true,
        );
        // Enable redaction
        vi.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "maySendRedactionForEvent").mockReturnValue(
            true,
        );

        await renderAndOpenMenu();

        await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
        ["View in timeline", "Forward", "Unpin", "Delete"].forEach((name) =>
            expect(screen.getByRole("menuitem", { name })).toBeInTheDocument(),
        );
        expect(screen.getByRole("menu")).toMatchSnapshot();
    });

    it("should view in the timeline", async () => {
        const { pinEvent } = await renderAndOpenMenu();

        // Test view in timeline button
        await userEvent.click(screen.getByRole("menuitem", { name: "View in timeline" }));
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: pinEvent.getId(),
            highlighted: true,
            room_id: pinEvent.getRoomId(),
            metricsTrigger: undefined, // room doesn't change
        });
    });

    it("should open forward dialog", async () => {
        const { pinEvent } = await renderAndOpenMenu();

        // Test forward button
        await userEvent.click(screen.getByRole("menuitem", { name: "Forward" }));
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.OpenForwardDialog,
            event: getForwardableEvent(pinEvent, mockClient),
            permalinkCreator: permalinkCreator,
        });
    });

    it("should unpin the event", async () => {
        const { pinEvent } = await renderAndOpenMenu();
        const pinEvent2 = makePinEvent({ event_id: "$eventId2" });

        const stateEvent = {
            getContent: vi.fn().mockReturnValue({ pinned: [pinEvent.getId(), pinEvent2.getId()] }),
        } as unknown as MatrixEvent;

        // Enable unpin
        vi.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "mayClientSendStateEvent").mockReturnValue(
            true,
        );
        // Mock the state event
        vi.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "getStateEvents").mockReturnValue(
            stateEvent,
        );

        // Test unpin button
        await userEvent.click(screen.getByRole("menuitem", { name: "Unpin" }));
        expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
            room.roomId,
            EventType.RoomPinnedEvents,
            {
                pinned: [pinEvent2.getId()],
            },
            "",
        );
    });

    it("should delete the event", async () => {
        // Enable redaction
        vi.spyOn(room.getLiveTimeline().getState(EventTimeline.FORWARDS)!, "maySendRedactionForEvent").mockReturnValue(
            true,
        );

        const { pinEvent } = await renderAndOpenMenu();

        await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
        expect(createRedactEventDialog).toHaveBeenCalledWith({
            mxEvent: pinEvent,
        });
    });
});
