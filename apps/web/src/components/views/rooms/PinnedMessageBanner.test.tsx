/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, render } from "test-utils-rtl";
import { EventType, type IEvent, type MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { makePollStartEvent, stubClient, clientAndSDKContextRenderOptions } from "test-utils";

import * as pinnedEventHooks from "../../../hooks/usePinnedEvents";
import { PinnedMessageBanner } from "./PinnedMessageBanner";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import dis from "../../../dispatcher/dispatcher";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { Action } from "../../../dispatcher/actions";
import { SDKContextClass } from "../../../contexts/SDKContextClass";

describe("<PinnedMessageBanner />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    let mockClient: MatrixClient;
    let room: Room;
    let permalinkCreator: RoomPermalinkCreator;
    let sdkContext: SDKContextClass;
    beforeEach(() => {
        mockClient = stubClient();
        room = new Room(roomId, mockClient, userId);
        permalinkCreator = new RoomPermalinkCreator(room);
        sdkContext = new SDKContextClass();
        vi.spyOn(dis, "dispatch").mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
        return render(
            <PinnedMessageBanner permalinkCreator={permalinkCreator} room={room} />,
            clientAndSDKContextRenderOptions(mockClient, sdkContext),
        );
    }

    it("should render nothing when there are no pinned events", async () => {
        vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([]);
        vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([]);
        const { container } = renderBanner();
        expect(container).toBeEmptyDOMElement();
    });

    it("should render a single pinned event", async () => {
        vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!]);
        vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1]);

        const { asFragment } = renderBanner();

        await expect(screen.findByText("First pinned message")).resolves.toBeVisible();
        expect(screen.queryByRole("button", { name: "View all" })).toBeNull();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render 2 pinned event", async () => {
        vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!, event2.getId()!]);
        vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2]);

        const { asFragment } = renderBanner();

        await expect(screen.findByText("Second pinned message")).resolves.toBeVisible();
        expect(screen.getByTestId("banner-counter")).toHaveTextContent("2 of 2 Pinned messages");
        expect(screen.getAllByTestId("banner-indicator")).toHaveLength(2);
        expect(screen.queryByRole("button", { name: "View all" })).toBeVisible();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render 4 pinned event", async () => {
        vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([
            event1.getId()!,
            event2.getId()!,
            event3.getId()!,
            event4.getId()!,
        ]);
        vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2, event3, event4]);

        const { asFragment } = renderBanner();

        await expect(screen.findByText("Fourth pinned message")).resolves.toBeVisible();
        expect(screen.getByTestId("banner-counter")).toHaveTextContent("4 of 4 Pinned messages");
        expect(screen.getAllByTestId("banner-indicator")).toHaveLength(3);
        expect(screen.queryByRole("button", { name: "View all" })).toBeVisible();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the last message when the pinned event array changed", async () => {
        vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!, event2.getId()!]);
        vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2]);

        const { asFragment, rerender } = renderBanner();
        await expect(screen.findByText("Second pinned message")).resolves.toBeVisible();
        await userEvent.click(
            screen.getByRole("button", {
                name: "View the pinned message in the timeline and the newest pinned message here",
            }),
        );
        expect(screen.getByText("First pinned message")).toBeVisible();

        vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([
            event1.getId()!,
            event2.getId()!,
            event3.getId()!,
        ]);
        vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2, event3]);
        rerender(<PinnedMessageBanner permalinkCreator={permalinkCreator} room={room} />);
        await expect(screen.findByText("Third pinned message")).resolves.toBeVisible();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should rotate the pinned events when the banner is clicked", async () => {
        vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!, event2.getId()!]);
        vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2]);

        renderBanner();
        await expect(screen.findByText("Second pinned message")).resolves.toBeVisible();

        await userEvent.click(
            screen.getByRole("button", {
                name: "View the pinned message in the timeline and the newest pinned message here",
            }),
        );
        expect(screen.getByText("First pinned message")).toBeVisible();
        expect(screen.getByTestId("banner-counter")).toHaveTextContent("1 of 2 Pinned messages");
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: event2.getId(),
            highlighted: true,
            room_id: room.roomId,
            metricsTrigger: undefined, // room doesn't change
        });

        await userEvent.click(
            screen.getByRole("button", {
                name: "View the pinned message in the timeline and the next oldest pinned message here",
            }),
        );
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
    ])("should display the %s event type", async (msgType, label) => {
        const body = `Message with ${msgType} type`;
        const event = makePinEvent({ content: { body, msgtype: msgType } });
        vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event.getId()!]);
        vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event]);

        const { asFragment } = renderBanner();
        await expect(screen.findByTestId("banner-message")).resolves.toHaveTextContent(`${label}: ${body}`);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display display a poll event", async () => {
        const event = makePollStartEvent("Alice?", userId);
        vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event.getId()!]);
        vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event]);

        const { asFragment } = renderBanner();
        await expect(screen.findByTestId("banner-message")).resolves.toHaveTextContent("Poll: Alice?");
        expect(asFragment()).toMatchSnapshot();
    });

    describe("Notify the timeline to resize", () => {
        beforeEach(() => {
            vi.spyOn(sdkContext.resizeNotifier, "notifyTimelineHeightChanged");
            vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!, event2.getId()!]);
            vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2]);
        });

        it("should notify the timeline to resize when we display the banner", async () => {
            renderBanner();
            await expect(screen.findByText("Second pinned message")).resolves.toBeVisible();
            // The banner is displayed, so we need to resize the timeline
            expect(sdkContext.resizeNotifier.notifyTimelineHeightChanged).toHaveBeenCalledTimes(1);

            await userEvent.click(
                screen.getByRole("button", {
                    name: "View the pinned message in the timeline and the newest pinned message here",
                }),
            );
            await expect(screen.findByText("First pinned message")).resolves.toBeVisible();
            // The banner is already displayed, so we don't need to resize the timeline
            expect(sdkContext.resizeNotifier.notifyTimelineHeightChanged).toHaveBeenCalledTimes(1);
        });

        it("should notify the timeline to resize when we hide the banner", async () => {
            const { rerender } = renderBanner();
            await expect(screen.findByText("Second pinned message")).resolves.toBeVisible();
            // The banner is displayed, so we need to resize the timeline
            expect(sdkContext.resizeNotifier.notifyTimelineHeightChanged).toHaveBeenCalledTimes(1);

            // The banner has no event to display and is hidden
            vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([]);
            vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([]);
            rerender(<PinnedMessageBanner permalinkCreator={permalinkCreator} room={room} />);
            // The timeline should be resized
            expect(sdkContext.resizeNotifier.notifyTimelineHeightChanged).toHaveBeenCalledTimes(2);
        });
    });

    describe("Right button", () => {
        beforeEach(() => {
            vi.spyOn(pinnedEventHooks, "usePinnedEvents").mockReturnValue([event1.getId()!, event2.getId()!]);
            vi.spyOn(pinnedEventHooks, "useSortedFetchedPinnedEvents").mockReturnValue([event1, event2]);
        });

        it("should display View all button if the right panel is closed", async () => {
            // The Right panel is closed
            vi.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(false);

            renderBanner();
            await expect(screen.findByText("Second pinned message")).resolves.toBeVisible();

            expect(screen.getByRole("button", { name: "View all" })).toBeVisible();
        });

        it("should display View all button if the right panel is not opened on the pinned message list", async () => {
            // The Right panel is opened on another card
            vi.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(true);
            vi.spyOn(RightPanelStore.instance, "currentCard", "get").mockReturnValue({
                phase: RightPanelPhases.MemberList,
            });

            renderBanner();
            await expect(screen.findByText("Second pinned message")).resolves.toBeVisible();

            expect(screen.getByRole("button", { name: "View all" })).toBeVisible();
        });

        it("should display Close list button if the message pinning list is displayed", async () => {
            // The Right panel is closed
            vi.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(true);
            vi.spyOn(RightPanelStore.instance, "currentCard", "get").mockReturnValue({
                phase: RightPanelPhases.PinnedMessages,
            });

            renderBanner();
            await expect(screen.findByText("Second pinned message")).resolves.toBeVisible();

            expect(screen.getByRole("button", { name: "Close list" })).toBeVisible();
        });

        it("should open or close the message pinning list", async () => {
            // The Right panel is closed
            vi.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(true);
            vi.spyOn(RightPanelStore.instance, "currentCard", "get").mockReturnValue({
                phase: RightPanelPhases.PinnedMessages,
            });
            vi.spyOn(RightPanelStore.instance, "showOrHidePhase").mockReturnValue();

            renderBanner();
            await userEvent.click(screen.getByRole("button", { name: "Close list" }));
            expect(RightPanelStore.instance.showOrHidePhase).toHaveBeenCalledWith(RightPanelPhases.PinnedMessages);
        });

        it("should listen to the right panel", async () => {
            // The Right panel is closed
            vi.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(true);
            vi.spyOn(RightPanelStore.instance, "currentCard", "get").mockReturnValue({
                phase: RightPanelPhases.PinnedMessages,
            });

            renderBanner();
            await expect(screen.findByText("Second pinned message")).resolves.toBeVisible();
            expect(screen.getByRole("button", { name: "Close list" })).toBeVisible();

            vi.spyOn(RightPanelStore.instance, "isOpenForRoom").mockReturnValue(false);
            act(() => {
                RightPanelStore.instance.emit(UPDATE_EVENT);
            });
            expect(screen.getByRole("button", { name: "View all" })).toBeVisible();
        });
    });
});
