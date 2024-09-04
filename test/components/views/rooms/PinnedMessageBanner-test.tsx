/*
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
 */

import { act, screen, render } from "@testing-library/react";
import React from "react";
import { EventType, IEvent, MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import * as pinnedEventHooks from "../../../../src/hooks/usePinnedEvents";
import { PinnedMessageBanner } from "../../../../src/components/views/rooms/PinnedMessageBanner";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { makePollStartEvent, stubClient } from "../../../test-utils";
import dis from "../../../../src/dispatcher/dispatcher";
import RightPanelStore from "../../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../../src/stores/right-panel/RightPanelStorePhases";
import { UPDATE_EVENT } from "../../../../src/stores/AsyncStore";
import { Action } from "../../../../src/dispatcher/actions";

describe("<PinnedMessageBanner />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    let mockClient: MatrixClient;
    let room: Room;
    let permalinkCreator: RoomPermalinkCreator;
    beforeEach(() => {
        mockClient = stubClient();
        room = new Room(roomId, mockClient, userId);
        permalinkCreator = new RoomPermalinkCreator(room);
        jest.spyOn(dis, "dispatch").mockReturnValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

    const event1 = makePinEvent();
    const event2 = makePinEvent({
        event_id: "$eventId2",
        content: { body: "Second pinned message" },
    });
    const event3 = makePinEvent({
        event_id: "$eventId3",
        content: { body: "Third pinned message" },
    });
    const event4 = makePinEvent({
        event_id: "$eventId4",
        content: { body: "Fourth pinned message" },
    });

    /**
     * Render the banner
     */
    function renderBanner() {
        return render(<PinnedMessageBanner permalinkCreator={permalinkCreator} room={room} />);
    }

    it("should render nothing when there are no pinned events", async () => {
        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([]);
        const { container } = renderBanner();
        expect(container).toBeEmptyDOMElement();
    });

    it("should render a single pinned event", async () => {
        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1]);

        const { asFragment } = renderBanner();

        expect(screen.getByText("First pinned message")).toBeVisible();
        expect(screen.queryByRole("button", { name: "View all" })).toBeNull();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render 2 pinned event", async () => {
        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!, event2.getId()!]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2]);

        const { asFragment } = renderBanner();

        expect(screen.getByText("Second pinned message")).toBeVisible();
        expect(screen.getByTestId("banner-counter")).toHaveTextContent("2 of 2 Pinned messages");
        expect(screen.getAllByTestId("banner-indicator")).toHaveLength(2);
        expect(screen.queryByRole("button", { name: "View all" })).toBeVisible();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render 4 pinned event", async () => {
        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([
            event1.getId()!,
            event2.getId()!,
            event3.getId()!,
            event4.getId()!,
        ]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2, event3, event4]);

        const { asFragment } = renderBanner();

        expect(screen.getByText("Fourth pinned message")).toBeVisible();
        expect(screen.getByTestId("banner-counter")).toHaveTextContent("4 of 4 Pinned messages");
        expect(screen.getAllByTestId("banner-indicator")).toHaveLength(3);
        expect(screen.queryByRole("button", { name: "View all" })).toBeVisible();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the last message when the pinned event array changed", async () => {
        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!, event2.getId()!]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2]);

        const { asFragment, rerender } = renderBanner();
        await userEvent.click(screen.getByRole("button", { name: "View the pinned message in the timeline." }));
        expect(screen.getByText("First pinned message")).toBeVisible();

        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([
            event1.getId()!,
            event2.getId()!,
            event3.getId()!,
        ]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2, event3]);
        rerender(<PinnedMessageBanner permalinkCreator={permalinkCreator} room={room} />);
        expect(screen.getByText("Third pinned message")).toBeVisible();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should rotate the pinned events when the banner is clicked", async () => {
        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!, event2.getId()!]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2]);

        renderBanner();
        expect(screen.getByText("Second pinned message")).toBeVisible();

        await userEvent.click(screen.getByRole("button", { name: "View the pinned message in the timeline." }));
        expect(screen.getByText("First pinned message")).toBeVisible();
        expect(screen.getByTestId("banner-counter")).toHaveTextContent("1 of 2 Pinned messages");
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: event2.getId(),
            highlighted: true,
            room_id: room.roomId,
            metricsTrigger: undefined, // room doesn't change
        });

        await userEvent.click(screen.getByRole("button", { name: "View the pinned message in the timeline." }));
        expect(screen.getByText("Second pinned message")).toBeVisible();
        expect(screen.getByTestId("banner-counter")).toHaveTextContent("2 of 2 Pinned messages");
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: event1.getId(),
            highlighted: true,
            room_id: room.roomId,
            metricsTrigger: undefined, // room doesn't change
        });
    });

    it.each([
        ["m.file", "File"],
        ["m.audio", "Audio"],
        ["m.video", "Video"],
        ["m.image", "Image"],
    ])("should display the %s event type", (msgType, label) => {
        const body = `Message with ${msgType} type`;
        const event = makePinEvent({ content: { body, msgtype: msgType } });
        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event.getId()!]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event]);

        const { asFragment } = renderBanner();
        expect(screen.getByTestId("banner-message")).toHaveTextContent(`${label}: ${body}`);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display display a poll event", async () => {
        const event = makePollStartEvent("Alice?", userId);
        jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event.getId()!]);
        jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event]);

        const { asFragment } = renderBanner();
        expect(screen.getByTestId("banner-message")).toHaveTextContent("Poll: Alice?");
        expect(asFragment()).toMatchSnapshot();
    });

    describe("Right button", () => {
        beforeEach(() => {
            jest.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!, event2.getId()!]);
            jest.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2]);
        });

        it("should display View all button if the right panel is closed", async () => {
            // The Right panel is closed
            jest.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(false);

            renderBanner();
            expect(screen.getByRole("button", { name: "View all" })).toBeVisible();
        });

        it("should display View all button if the right panel is not opened on the pinned message list", async () => {
            // The Right panel is opened on another card
            jest.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(true);
            jest.spyOn(RightPanelStore.instance, "currentCard", "get").mockReturnValue({
                phase: RightPanelPhases.RoomMemberList,
            });

            renderBanner();
            expect(screen.getByRole("button", { name: "View all" })).toBeVisible();
        });

        it("should display Close list button if the message pinning list is displayed", async () => {
            // The Right panel is closed
            jest.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(true);
            jest.spyOn(RightPanelStore.instance, "currentCard", "get").mockReturnValue({
                phase: RightPanelPhases.PinnedMessages,
            });

            renderBanner();
            expect(screen.getByRole("button", { name: "Close list" })).toBeVisible();
        });

        it("should open or close the message pinning list", async () => {
            // The Right panel is closed
            jest.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(true);
            jest.spyOn(RightPanelStore.instance, "currentCard", "get").mockReturnValue({
                phase: RightPanelPhases.PinnedMessages,
            });
            jest.spyOn(RightPanelStore.instance, "showOrHidePhase").mockReturnValue();

            renderBanner();
            await userEvent.click(screen.getByRole("button", { name: "Close list" }));
            expect(RightPanelStore.instance.showOrHidePhase).toHaveBeenCalledWith(RightPanelPhases.PinnedMessages);
        });

        it("should listen to the right panel", async () => {
            // The Right panel is closed
            jest.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(true);
            jest.spyOn(RightPanelStore.instance, "currentCard", "get").mockReturnValue({
                phase: RightPanelPhases.PinnedMessages,
            });

            renderBanner();
            expect(screen.getByRole("button", { name: "Close list" })).toBeVisible();

            jest.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(false);
            act(() => {
                RightPanelStore.instance.emit(UPDATE_EVENT);
            });
            expect(screen.getByRole("button", { name: "View all" })).toBeVisible();
        });
    });
});
