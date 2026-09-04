/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import {
    EventStatus,
    EventType,
    type IEventDecryptionResult,
    type MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    NotificationCountType,
    PendingEventOrdering,
    RelationType,
    type Relations,
    Room,
    RoomMember,
} from "matrix-js-sdk/src/matrix";
import {
    type CryptoApi,
    DecryptionFailureCode,
    type EventEncryptionInfo,
    EventShieldColour,
    EventShieldReason,
} from "matrix-js-sdk/src/crypto-api";
import { mkEncryptedMatrixEvent } from "matrix-js-sdk/src/testing";
import { getByTestId } from "@testing-library/dom";
import { filterConsole, flushPromises, getRoomContext, mkEvent, mkMessage, stubClient } from "test-utils";
import { mkThread } from "test-utils/threads";

import EventTile, { type EventTileProps } from "./EventTile";
import * as EventTileFactory from "../../../events/EventTileFactory";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { type RoomContextType, TimelineRenderingType } from "../../../contexts/RoomContext";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import DMRoomMap from "../../../utils/DMRoomMap";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import PinningUtils from "../../../utils/PinningUtils";
import { Layout } from "../../../settings/enums/Layout";
import { ScopedRoomContextProvider } from "../../../contexts/ScopedRoomContext.tsx";
import SettingsStore from "../../../settings/SettingsStore";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import PlatformPeg from "../../../PlatformPeg";
import { EventPresentationContextProvider } from "../../../utils/EventPresentationContextProvider.tsx";

function getTile(container: HTMLElement): HTMLElement {
    const tile = container.querySelector(".mx_EventTile");
    expect(tile).not.toBeNull();
    return tile as HTMLElement;
}

function getLine(container: HTMLElement): HTMLElement {
    const line = container.querySelector(".mx_EventTile_line");
    expect(line).not.toBeNull();
    return line as HTMLElement;
}

function stubHoverMatches(hoveredElement: HTMLElement): void {
    const matches = HTMLElement.prototype.matches;
    vi.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (this: HTMLElement, selector: string) {
        if (selector === ":hover") return this === hoveredElement;
        return matches.call(this, selector);
    });
}

function makeReplyEvent(roomId: string): MatrixEvent {
    const parentEvent = mkMessage({
        room: roomId,
        user: "@alice:example.org",
        msg: "Original message",
        event: true,
    });

    return mkMessage({
        room: roomId,
        user: "@bob:example.org",
        msg: "Reply message",
        event: true,
        relatesTo: {
            "m.in_reply_to": {
                event_id: parentEvent.getId(),
            },
        },
    });
}

function makeThreadReplyEvent(roomId: string): MatrixEvent {
    return mkMessage({
        room: roomId,
        user: "@alice:example.org",
        msg: "Hello world!",
        ts: 1234,
        event: true,
        relatesTo: {
            rel_type: "m.thread",
            event_id: "$thread-root",
        },
    });
}

function makeReactionEvent(roomId: string, targetEventId: string, sender: string, key: string): MatrixEvent {
    return mkEvent({
        event: true,
        type: EventType.Reaction,
        room: roomId,
        user: sender,
        content: {
            "m.relates_to": {
                rel_type: RelationType.Annotation,
                event_id: targetEventId,
                key,
            },
        },
    });
}

function makeRelations(
    reactionsByKey: Map<string, MatrixEvent[]>,
    reactionsBySender: Record<string, MatrixEvent[]> = {},
): Relations {
    return {
        getSortedAnnotationsByKey: () =>
            [...reactionsByKey.entries()].map(([key, events]) => [key, new Set(events)] as [string, Set<MatrixEvent>]),
        getAnnotationsBySender: () =>
            Object.fromEntries(
                Object.entries(reactionsBySender).map(([sender, events]) => [
                    sender,
                    new Map(events.map((ev) => [ev.getId(), ev])),
                ]),
            ),
        on: vi.fn(),
        off: vi.fn(),
    } as unknown as Relations;
}

describe("EventTile", () => {
    const ROOM_ID = "!roomId:example.org";
    let mxEvent: MatrixEvent;
    let room: Room;
    let client: MatrixClient;

    // let changeEvent: (event: MatrixEvent) => void;

    /** wrap the EventTile up in context providers, and with basic properties, as it would be by MessagePanel normally. */
    function WrappedEventTile(props: {
        roomContext: RoomContextType;
        eventTilePropertyOverrides?: Partial<EventTileProps>;
    }) {
        const layout = props.eventTilePropertyOverrides?.layout ?? Layout.Group;

        return (
            <MatrixClientContext.Provider value={client}>
                <ScopedRoomContextProvider {...props.roomContext}>
                    <EventPresentationContextProvider layout={layout}>
                        <EventTile
                            mxEvent={mxEvent}
                            replacingEventId={mxEvent.replacingEventId()}
                            {...(props.eventTilePropertyOverrides ?? {})}
                        />
                    </EventPresentationContextProvider>
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>
        );
    }

    function getComponent(
        overrides: Partial<EventTileProps> = {},
        renderingType: TimelineRenderingType = TimelineRenderingType.Room,
        roomContext: Partial<RoomContextType> = {},
    ) {
        const context = getRoomContext(room, {
            timelineRenderingType: renderingType,
            ...roomContext,
        });
        return render(<WrappedEventTile roomContext={context} eventTilePropertyOverrides={overrides} />);
    }

    function makeOwnMessage(overrides: Partial<Parameters<typeof mkMessage>[0]> = {}): MatrixEvent {
        return mkMessage({
            ...overrides,
            room: overrides.room ?? room.roomId,
            user: overrides.user ?? client.getSafeUserId(),
            msg: overrides.msg ?? "Hello world!",
            event: overrides.event ?? true,
        });
    }

    function makeTimestampedMessage(overrides: Partial<Parameters<typeof mkMessage>[0]> = {}): MatrixEvent {
        return mkMessage({
            ...overrides,
            room: overrides.room ?? room.roomId,
            user: overrides.user ?? "@alice:example.org",
            msg: overrides.msg ?? "Hello world!",
            ts: overrides.ts ?? 1234,
            event: overrides.event ?? true,
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.safeGet();
        vi.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: vi.fn().mockReturnValue(undefined),
        } as unknown as DMRoomMap);

        room = new Room(ROOM_ID, client, client.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
            timelineSupport: true,
        });

        vi.spyOn(client, "getRoom").mockReturnValue(room);
        vi.spyOn(client, "decryptEventIfNeeded").mockResolvedValue();
        vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);

        mxEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Hello world!",
            event: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("layout and tile attributes", () => {
        it("exposes the rendered event id in room timelines", () => {
            const { container } = getComponent();

            expect(getTile(container)).toHaveAttribute("data-event-id", mxEvent.getId());
        });

        it("renders the event line inside the tile", () => {
            const { container } = getComponent();

            expect(getTile(container)).toContainElement(getLine(container));
        });

        it("does not render empty shared slot boundaries", () => {
            const { container } = getComponent({ continuation: true });

            for (const slotName of ["avatar", "sender", "timestamp", "footer", "threadInfo", "receipt"] as const) {
                expect(container.querySelector(`[data-testid="event-tile-slot-${slotName}"]`)).toBeNull();
            }
        });

        it("preserves the existing root and line markup", () => {
            const { container } = getComponent();
            const tile = getTile(container);

            expect(tile.tagName).toBe("LI");
            expect(tile).toContainElement(getLine(container));
            expect(getLine(container)).toHaveClass("mx_EventTile_line");
        });

        it("does not expose a scroll token for local echo events", () => {
            const localEcho = makeOwnMessage();
            localEcho.setStatus(EventStatus.SENDING);
            const { container } = getComponent({ mxEvent: localEcho, eventSendStatus: EventStatus.SENDING });

            expect(getTile(container)).not.toHaveAttribute("data-scroll-tokens");
        });

        it("sets aria-live to off when the send status is undefined", () => {
            const { container } = getComponent();

            expect(getTile(container)).toHaveAttribute("aria-live", "off");
        });

        it("does not set aria-live when the send status is explicitly null", () => {
            const { container } = getComponent({ eventSendStatus: null as unknown as EventStatus });

            expect(getTile(container)).not.toHaveAttribute("aria-live");
        });
    });

    describe("shared root attributes", () => {
        it.each([
            TimelineRenderingType.Room,
            TimelineRenderingType.Thread,
            TimelineRenderingType.ThreadsList,
            TimelineRenderingType.Notification,
            TimelineRenderingType.File,
        ])("keeps stable DOM identifiers for %s rendering", (renderingType) => {
            const { container } = getComponent({}, renderingType);
            const tile = getTile(container);
            expect(tile).toHaveAttribute("data-scroll-tokens", mxEvent.getId());
            expect(tile).toHaveAttribute("data-event-id", mxEvent.getId());
            expect(tile).not.toHaveAttribute("data-layout");
            expect(tile).not.toHaveAttribute("data-shape");
            expect(tile).not.toHaveAttribute("data-self");
            expect(tile).not.toHaveAttribute("data-has-reply");
        });
    });

    describe("timestamps", () => {
        beforeEach(() => {
            mxEvent = makeTimestampedMessage();
        });

        it("hides the timestamp by default in room timelines", () => {
            const { container } = getComponent();

            expect(container.querySelector(".mx_MessageTimestamp")).toBeNull();
        });

        it("shows the timestamp when the tile is hovered", async () => {
            const { container } = getComponent();
            const tile = getTile(container);
            stubHoverMatches(tile);

            expect(container.querySelector(".mx_MessageTimestamp")).toBeNull();

            await userEvent.hover(tile);

            expect(container.querySelector(".mx_MessageTimestamp")).not.toBeNull();
        });

        it("shows the timestamp when focus is within the tile", () => {
            const { container } = getComponent();

            expect(container.querySelector(".mx_MessageTimestamp")).toBeNull();

            act(() => {
                getTile(container).focus();
            });

            expect(container.querySelector(".mx_MessageTimestamp")).not.toBeNull();
        });

        it("shows the timestamp for the last event", () => {
            const { container } = getComponent({ last: true });

            expect(container.querySelector(".mx_MessageTimestamp")).not.toBeNull();
        });

        it("shows the timestamp when timestamps are always shown", () => {
            const { container } = getComponent({ alwaysShowTimestamps: true });

            expect(container.querySelector(".mx_MessageTimestamp")).not.toBeNull();
        });

        it("hides the timestamp when timestamps are disabled for the tile", () => {
            const { container } = getComponent({ alwaysShowTimestamps: true, hideTimestamp: true });

            expect(container.querySelector(".mx_MessageTimestamp")).toBeNull();
        });

        it("does not render a placeholder timestamp in IRC layout", () => {
            const { container } = getComponent({ layout: Layout.IRC });

            expect(container.querySelector(".mx_MessageTimestamp")).toBeNull();
        });

        it("dispatches a room view when the linked timestamp is clicked", () => {
            vi.spyOn(dis, "dispatch").mockImplementation(() => {});
            const permalinkCreator = new RoomPermalinkCreator(room);
            const { container } = getComponent({ alwaysShowTimestamps: true, permalinkCreator });
            const timestamp = container.querySelector<HTMLAnchorElement>("a.mx_MessageTimestamp");

            expect(timestamp).not.toBeNull();
            fireEvent.click(timestamp!);

            expect(dis.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: Action.ViewRoom,
                    event_id: mxEvent.getId(),
                    highlighted: true,
                    room_id: room.roomId,
                }),
            );
        });
    });

    describe("sender and avatar rendering", () => {
        it("keeps the sender/avatar composition in room timelines", () => {
            const { container } = getComponent();

            expect(container.querySelector(".mx_DisambiguatedProfile")).not.toBeNull();
            expect(container.querySelector('[data-testid="event-tile-slot-avatar"]')).not.toBeNull();
        });

        it("hides sender and avatar for continuation events in room timelines", () => {
            const { container } = getComponent({ continuation: true });

            expect(container.querySelector(".mx_DisambiguatedProfile")).toBeNull();
            expect(container.querySelector('[data-testid="event-tile-slot-avatar"]')).toBeNull();
        });

        it("hides sender but keeps avatar when sender display is disabled", () => {
            const { container } = getComponent({ hideSender: true });

            expect(container.querySelector(".mx_DisambiguatedProfile")).toBeNull();
            expect(container.querySelector('[data-testid="event-tile-slot-avatar"]')).not.toBeNull();
        });

        it("renders sender details as a permalink in file timelines", () => {
            const { container } = getComponent({}, TimelineRenderingType.File);
            const senderSlot = container.querySelector('[data-testid="event-tile-slot-sender"]');
            const senderDetailsLink = senderSlot?.closest("a");

            expect(senderDetailsLink).not.toBeNull();
            expect(senderDetailsLink).toContainElement(container.querySelector(".mx_DisambiguatedProfile"));
            expect(senderDetailsLink).toContainElement(
                container.querySelector('[data-testid="event-tile-slot-avatar"]'),
            );
        });

        it("renders sender details in thread timelines", () => {
            const { container } = getComponent({}, TimelineRenderingType.Thread);
            const senderSlot = container.querySelector('[data-testid="event-tile-slot-sender"]');
            const avatarSlot = container.querySelector<HTMLElement>('[data-testid="event-tile-slot-avatar"]');
            const senderDetails = senderSlot?.parentElement;

            expect(senderDetails).not.toBeNull();
            expect(senderDetails).toContainElement(container.querySelector(".mx_DisambiguatedProfile"));
            expect(senderDetails).toContainElement(avatarSlot);
        });

        it("keeps sender and avatar when only the layout prop is set to bubble", () => {
            const { container } = getComponent({ layout: Layout.Bubble });

            expect(container.querySelector(".mx_DisambiguatedProfile")).not.toBeNull();
            expect(container.querySelector('[data-testid="event-tile-slot-avatar"]')).not.toBeNull();
        });

        it("hides the sender but keeps the info-message avatar for room create events", () => {
            const createEvent = mkEvent({
                event: true,
                type: EventType.RoomCreate,
                room: room.roomId,
                user: "@alice:example.org",
                content: { creator: "@alice:example.org", room_version: "1" },
            });
            const { container } = getComponent({ mxEvent: createEvent }, TimelineRenderingType.Room, {
                showHiddenEvents: true,
            });

            expect(container.querySelector(".mx_DisambiguatedProfile")).toBeNull();
            expect(container.querySelector('[data-testid="event-tile-slot-avatar"]')).not.toBeNull();
        });

        it("renders the notification avatar independently from the sender details", () => {
            const { container } = getComponent({}, TimelineRenderingType.Notification);
            const details = container.querySelector('[data-testid="event-tile-slot-sender"]')?.parentElement;
            const avatar = container.querySelector<HTMLElement>('[data-testid="event-tile-slot-roomAvatar"]');

            expect(details).not.toBeNull();
            expect(avatar).not.toBeNull();
            expect(details).not.toContainElement(avatar);
        });
    });

    describe("read receipt option", () => {
        it("shows a sent receipt for the current user's last successful event", () => {
            const ownEvent = makeOwnMessage();
            const { getByRole } = getComponent({ mxEvent: ownEvent, lastSuccessful: true });

            expect(getByRole("status")).toHaveAccessibleName("Your message was sent");
        });

        it.each([
            [EventStatus.SENDING, "Sending your message…"],
            [EventStatus.ENCRYPTING, "Encrypting your message…"],
            [EventStatus.NOT_SENT, "Failed to send"],
        ])("shows the %s receipt for the current user's pending event", (eventSendStatus, label) => {
            const ownEvent = makeOwnMessage();
            ownEvent.setStatus(eventSendStatus);
            const { getByRole } = getComponent({ mxEvent: ownEvent, eventSendStatus });

            expect(getByRole("status")).toHaveAccessibleName(label);
        });

        it("does not show a sent receipt in the threads list", () => {
            const ownEvent = makeOwnMessage();
            const { queryByRole } = getComponent(
                { mxEvent: ownEvent, lastSuccessful: true },
                TimelineRenderingType.ThreadsList,
            );

            expect(queryByRole("status", { name: "Your message was sent" })).toBeNull();
        });

        it("shows normal read receipts instead of the sent receipt when other users have read the event", () => {
            const ownEvent = makeOwnMessage();
            const { getByRole, queryByRole } = getComponent({
                mxEvent: ownEvent,
                lastSuccessful: true,
                showReadReceipts: true,
                readReceipts: [
                    {
                        userId: "@bob:example.org",
                        roomMember: null,
                        ts: 1234,
                    },
                ],
            });

            expect(queryByRole("status", { name: "Your message was sent" })).toBeNull();
            expect(getByRole("group", { name: "Seen by 1 person" })).toBeInTheDocument();
        });
    });

    describe("reactions and footer", () => {
        it("gets annotation relations when reactions are enabled", () => {
            const getRelationsForEvent = vi.fn().mockReturnValue(null);

            getComponent({ showReactions: true, getRelationsForEvent });

            expect(getRelationsForEvent).toHaveBeenCalledWith(mxEvent.getId(), "m.annotation", "m.reaction");
        });

        it("does not get annotation relations when reactions are disabled", () => {
            const getRelationsForEvent = vi.fn().mockReturnValue(null);

            getComponent({ getRelationsForEvent });

            expect(getRelationsForEvent).not.toHaveBeenCalled();
        });

        it("refreshes annotation relations when reaction relations are created", () => {
            const getRelationsForEvent = vi.fn().mockReturnValue(null);
            getComponent({ showReactions: true, getRelationsForEvent });
            getRelationsForEvent.mockClear();

            act(() => {
                mxEvent.emit(MatrixEventEvent.RelationsCreated, "m.annotation", "m.reaction");
            });

            expect(getRelationsForEvent).toHaveBeenCalledWith(mxEvent.getId(), "m.annotation", "m.reaction");
        });

        it("does not refresh annotation relations for unrelated relations", () => {
            const getRelationsForEvent = vi.fn().mockReturnValue(null);
            getComponent({ showReactions: true, getRelationsForEvent });
            getRelationsForEvent.mockClear();

            act(() => {
                mxEvent.emit(MatrixEventEvent.RelationsCreated, "m.reference", "m.room.message");
            });

            expect(getRelationsForEvent).not.toHaveBeenCalled();
        });

        it("does not render reactions for redacted events", () => {
            const getRelationsForEvent = vi.fn().mockReturnValue(null);
            const { container } = getComponent({ showReactions: true, getRelationsForEvent, isRedacted: true });

            expect(container.querySelector(".mx_ReactionsRow")).toBeNull();
        });

        it("renders a footer for pinned messages", () => {
            vi.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            const { container } = getComponent();

            expect(container.querySelector('[data-testid="event-tile-slot-footer"]')).not.toBeNull();
            expect(screen.getByText("Pinned message")).toBeInTheDocument();
        });

        it("renders the IRC footer inside the event line", () => {
            vi.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            const { container } = getComponent({ layout: Layout.IRC });

            expect(getLine(container).querySelector('[data-testid="event-tile-slot-footer"]')).not.toBeNull();
            expect(getTile(container).querySelector(':scope > [data-testid="event-tile-slot-footer"]')).toBeNull();
        });

        it("renders a bubble footer for an own pinned message", () => {
            vi.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            const ownEvent = makeOwnMessage();
            const { container } = getComponent({ mxEvent: ownEvent, layout: Layout.Bubble });
            const footer = container.querySelector('[data-testid="event-tile-slot-footer"]');

            expect(footer).not.toBeNull();
            expect(footer).toHaveTextContent("Pinned message");
        });

        it("renders relation groups and deduplicates reactions from the same sender", () => {
            const bobReaction1 = makeReactionEvent(room.roomId, mxEvent.getId()!, "@bob:example.org", "👍");
            const bobReaction2 = makeReactionEvent(room.roomId, mxEvent.getId()!, "@bob:example.org", "👍");
            const getRelationsForEvent = vi
                .fn()
                .mockReturnValue(makeRelations(new Map([["👍", [bobReaction1, bobReaction2]]])));

            getComponent({ showReactions: true, getRelationsForEvent }, TimelineRenderingType.Room, {
                canReact: true,
            });

            const reactionButton = screen.getByRole("button", { name: /@bob:example\.org reacted with 👍/ });
            expect(reactionButton).toHaveTextContent("👍1");
        });

        it("detects the current user's reaction when rendering relation groups", () => {
            const ownReaction = makeReactionEvent(room.roomId, mxEvent.getId()!, client.getSafeUserId(), "👍");
            const getRelationsForEvent = vi.fn().mockReturnValue(
                makeRelations(new Map([["👍", [ownReaction]]]), {
                    [client.getSafeUserId()]: [ownReaction],
                }),
            );

            getComponent({ showReactions: true, getRelationsForEvent }, TimelineRenderingType.Room, {
                canReact: true,
                canSelfRedact: false,
            });

            expect(screen.getByRole("button", { name: /reacted with 👍/ })).toHaveAttribute("aria-disabled", "true");
        });
    });

    describe("action bar", () => {
        it("does not render the message action bar by default", () => {
            const { container } = getComponent();

            expect(container.querySelector(".mx_MessageActionBar")).toBeNull();
        });

        it("renders the message action bar when the tile is hovered", async () => {
            const { container } = getComponent();
            const tile = getTile(container);
            stubHoverMatches(tile);

            await userEvent.hover(tile);

            expect(container.querySelector(".mx_MessageActionBar")).not.toBeNull();
        });

        it("renders the message action bar when the tile receives keyboard focus", () => {
            const matches = HTMLElement.prototype.matches;
            vi.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (this: HTMLElement, selector) {
                if (selector === ":focus-visible") return true;
                return matches.call(this, selector);
            });
            const { container } = getComponent();

            act(() => {
                getTile(container).focus();
            });

            expect(container.querySelector(".mx_MessageActionBar")).not.toBeNull();
        });

        it("hides the keyboard-focused message action bar when focus leaves the tile", () => {
            const matches = HTMLElement.prototype.matches;
            vi.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (this: HTMLElement, selector) {
                if (selector === ":focus-visible") return true;
                return matches.call(this, selector);
            });
            const { container } = getComponent();
            const tile = getTile(container);

            act(() => {
                tile.focus();
            });
            expect(container.querySelector(".mx_MessageActionBar")).not.toBeNull();

            act(() => {
                tile.blur();
            });

            expect(container.querySelector(".mx_MessageActionBar")).toBeNull();
        });

        it("does not render the message action bar on hover when exporting", async () => {
            const { container } = getComponent({ forExport: true });

            await userEvent.hover(getTile(container));

            expect(container.querySelector(".mx_MessageActionBar")).toBeNull();
        });

        it("does not render the message action bar on hover while editing", async () => {
            const { container } = getComponent({ editState: {} as EventTileProps["editState"] });

            await userEvent.hover(getTile(container));

            expect(container.querySelector(".mx_MessageActionBar")).toBeNull();
        });
    });

    describe("context menu", () => {
        it("renders the message context menu when the event line is right-clicked", async () => {
            const { container } = getComponent();

            fireEvent.contextMenu(getLine(container), { clientX: 1, clientY: 2 });

            expect(await screen.findByTestId("mx_MessageContextMenu")).toBeInTheDocument();
        });

        it("shows the timestamp while the context menu is open", async () => {
            mxEvent = makeTimestampedMessage();
            const { container } = getComponent();

            expect(container.querySelector(".mx_MessageTimestamp")).toBeNull();

            fireEvent.contextMenu(getLine(container), { clientX: 1, clientY: 2 });

            expect(await screen.findByTestId("mx_MessageContextMenu")).toBeInTheDocument();
            expect(container.querySelector(".mx_MessageTimestamp")).not.toBeNull();
        });

        it("does not render the message context menu while editing", () => {
            const { container } = getComponent({ editState: {} as EventTileProps["editState"] });

            expect(container.querySelector(".mx_EventTile_line")).toBeNull();
            expect(screen.queryByTestId("mx_MessageContextMenu")).toBeNull();
        });

        it("does not override the native browser context menu for links", () => {
            const { container } = getComponent();
            vi.spyOn(PlatformPeg, "get").mockReturnValue({
                allowOverridingNativeContextMenus: () => false,
            } as ReturnType<typeof PlatformPeg.get>);
            const link = document.createElement("a");
            link.href = "https://example.org/";
            getLine(container).appendChild(link);

            const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 1, clientY: 2 });
            link.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(false);
            expect(screen.queryByTestId("mx_MessageContextMenu")).toBeNull();
        });
    });

    describe("reply chain", () => {
        it("does not render a reply chain for non-reply events", () => {
            const { container } = getComponent();

            expect(container.querySelector(".mx_ReplyChain_wrapper")).toBeNull();
        });

        it("renders a reply chain for reply events", () => {
            const replyEvent = makeReplyEvent(room.roomId);
            const { container } = getComponent({ mxEvent: replyEvent });

            expect(container.querySelector(".mx_ReplyChain_wrapper")).not.toBeNull();
        });

        it("does not render the reply chain for redacted reply events", () => {
            const replyEvent = makeReplyEvent(room.roomId);
            vi.spyOn(replyEvent, "isRedacted").mockReturnValue(true);
            const { container } = getComponent({ mxEvent: replyEvent });

            expect(container.querySelector(".mx_ReplyChain_wrapper")).toBeNull();
        });
    });

    describe("EventTile thread summary", () => {
        beforeEach(() => {
            vi.spyOn(client, "supportsThreads").mockReturnValue(true);
        });

        it("removes the thread summary when thread is deleted", async () => {
            const {
                rootEvent,
                events: [, reply],
            } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@alice:example.org"],
                length: 2, // root + 1 answer
            });
            getComponent(
                {
                    mxEvent: rootEvent,
                },
                TimelineRenderingType.Room,
            );

            await waitFor(() => expect(screen.queryByTestId("thread-summary")).not.toBeNull());

            const redaction = mkEvent({
                event: true,
                type: EventType.RoomRedaction,
                user: "@alice:example.org",
                room: room.roomId,
                redacts: reply.getId(),
                content: {},
            });

            act(() => room.processThreadedEvents([redaction], false));

            await waitFor(() => expect(screen.queryByTestId("thread-summary")).toBeNull());
        });
    });

    describe("search thread info", () => {
        it("renders search thread info for events in a thread", () => {
            const threadEvent = makeThreadReplyEvent(room.roomId);
            const { container } = getComponent({ mxEvent: threadEvent }, TimelineRenderingType.Search);

            expect(container.querySelector(".mx_ThreadSummary_icon")).not.toBeNull();
            expect(container.querySelector(".mx_ThreadSummary_icon")).toHaveTextContent("From a thread");
        });

        it("renders search thread info as a link when a highlight link is provided", () => {
            const threadEvent = makeThreadReplyEvent(room.roomId);
            const { container } = getComponent(
                { mxEvent: threadEvent, highlightLink: "https://example.org/thread" },
                TimelineRenderingType.Search,
            );
            const threadInfo = container.querySelector<HTMLAnchorElement>("a.mx_ThreadSummary_icon");

            expect(threadInfo).not.toBeNull();
            expect(threadInfo).toHaveAttribute("href", "https://example.org/thread");
        });

        it("renders search thread info as text when no highlight link is provided", () => {
            const threadEvent = makeThreadReplyEvent(room.roomId);
            const { container } = getComponent({ mxEvent: threadEvent }, TimelineRenderingType.Search);
            const threadInfo = container.querySelector(".mx_ThreadSummary_icon");

            expect(threadInfo?.tagName).toBe("P");
        });

        it("does not render search thread info outside search timelines", () => {
            const threadEvent = makeThreadReplyEvent(room.roomId);
            const { container } = getComponent({ mxEvent: threadEvent }, TimelineRenderingType.Room);

            expect(container.querySelector(".mx_ThreadSummary_icon")).toBeNull();
        });
    });

    describe("EventTile renderingType: ThreadsList", () => {
        it("shows an unread notification badge", () => {
            const { container } = getComponent({}, TimelineRenderingType.ThreadsList);

            // By default, the thread will assume it is read.
            expect(container.querySelectorAll('[data-testid="notification-badge"]')).toHaveLength(0);

            act(() => {
                room.setThreadUnreadNotificationCount(mxEvent.getId()!, NotificationCountType.Total, 3);
            });

            let badges = container.querySelectorAll('[data-testid="notification-badge"]');
            expect(badges).toHaveLength(1);
            expect(badges[0]).toHaveAttribute("data-badge-type", "dot");
            expect(badges[0]).toHaveAttribute("data-notification-level", "notification");

            act(() => {
                room.setThreadUnreadNotificationCount(mxEvent.getId()!, NotificationCountType.Highlight, 1);
            });

            badges = container.querySelectorAll('[data-testid="notification-badge"]');
            expect(badges).toHaveLength(1);
            expect(badges[0]).toHaveAttribute("data-badge-type", "dot");
            expect(badges[0]).toHaveAttribute("data-notification-level", "highlight");
        });
    });

    describe("EventTile renderingType: Threads", () => {
        it("should display the pinned message badge", async () => {
            vi.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            getComponent({}, TimelineRenderingType.Thread);

            expect(screen.getByText("Pinned message")).toBeInTheDocument();
        });
    });

    describe("EventTile renderingType: File", () => {
        it("should not display the pinned message badge", async () => {
            vi.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            getComponent({}, TimelineRenderingType.File);

            expect(screen.queryByText("Pinned message")).not.toBeInTheDocument();
        });
    });

    describe("EventTile renderingType: default", () => {
        it.each([[Layout.Group], [Layout.Bubble], [Layout.IRC]])(
            "should display the pinned message badge",
            async (layout) => {
                vi.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
                getComponent({ layout });

                expect(screen.getByText("Pinned message")).toBeInTheDocument();
            },
        );

        it("uses the current room member when current profiles are enabled", async () => {
            const senderId = mxEvent.getSender()!;
            const currentMember = new RoomMember(room.roomId, senderId);
            currentMember.rawDisplayName = "Alan (away)";

            vi.spyOn(room, "getMember").mockImplementation((userId) => (userId === senderId ? currentMember : null));
            vi.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "useOnlyCurrentProfiles",
            );

            const { container } = getComponent();

            await waitFor(() =>
                expect(container.querySelector(".mx_DisambiguatedProfile_displayName")).toHaveTextContent(
                    "Alan (away)",
                ),
            );
        });

        it("renders the tile error fallback when tile rendering throws", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            vi.spyOn(EventTileFactory, "renderTile").mockImplementation(() => {
                throw new Error("Boom");
            });

            getComponent();

            await waitFor(() => {
                expect(screen.getByText("Can't load this message (m.room.message)")).toBeInTheDocument();
            });
        });

        it("renders a notice when the event has no renderer", () => {
            const unsupportedEvent = mkEvent({
                event: true,
                type: "org.example.unsupported",
                room: room.roomId,
                user: "@alice:example.org",
                content: {},
            });

            getComponent({ mxEvent: unsupportedEvent });

            expect(screen.getByText("This event could not be displayed")).toBeInTheDocument();
        });

        it("updates the rendered message body when an edit changes msgtype to m.emote", async () => {
            const { container } = getComponent();
            expect(container.querySelector(".mx_MEmoteBody")).toBeNull();

            const edit = new MatrixEvent({
                type: EventType.RoomMessage,
                room_id: ROOM_ID,
                sender: "@alice:example.org",
                content: {
                    "body": "* waves",
                    "msgtype": "m.emote",
                    "m.new_content": {
                        body: "waves",
                        msgtype: "m.emote",
                    },
                    "m.relates_to": {
                        rel_type: "m.replace",
                        event_id: mxEvent.getId(),
                    },
                },
            });

            act(() => {
                mxEvent.makeReplaced(edit);
            });

            await waitFor(() => expect(container.querySelector(".mx_MEmoteBody")).not.toBeNull());
        });
    });

    describe("EventTile in the right panel", () => {
        it("does not render an empty unread notification badge slot", () => {
            const { container } = getComponent({}, TimelineRenderingType.Notification);

            expect(container.querySelector('[data-testid="event-tile-slot-notificationBadge"]')).toBeNull();
        });

        it("renders the room name for notifications", () => {
            const { container } = getComponent({}, TimelineRenderingType.Notification);
            const details = container.querySelector('[data-testid="event-tile-slot-sender"]')?.parentElement;
            expect(details).toHaveTextContent("@alice:example.org in !roomId:example.org");
        });

        it("renders the sender for the thread list", () => {
            const { container } = getComponent({}, TimelineRenderingType.ThreadsList);
            const details = container.querySelector('[data-testid="event-tile-slot-sender"]')?.parentElement;
            expect(details).toHaveTextContent("@alice:example.org");
        });

        it("renders the shared redacted body for thread previews", () => {
            vi.spyOn(mxEvent, "isRedacted").mockReturnValue(true);
            vi.spyOn(mxEvent, "getUnsigned").mockReturnValue({
                redacted_because: {
                    sender: "@moderator:example.org",
                    origin_server_ts: Date.UTC(2022, 10, 17, 15, 58, 32),
                },
            } as any);

            const { container } = getComponent({}, TimelineRenderingType.ThreadsList);
            const redactedBody = container.querySelector(".mx_RedactedBody");

            expect(redactedBody).not.toBeNull();
            expect(redactedBody).toHaveTextContent("Message deleted by @moderator:example.org");
        });

        it.each([
            [TimelineRenderingType.Notification, Action.ViewRoom],
            [TimelineRenderingType.ThreadsList, Action.ShowThread],
        ])("type %s dispatches %s", (renderingType, action) => {
            vi.spyOn(dis, "dispatch").mockImplementation(() => {});

            const { container } = getComponent({}, renderingType);

            fireEvent.click(container.querySelector("li")!);

            expect(dis.dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action,
                }),
            );
        });
    });
    describe("Event verification", () => {
        // data for our stubbed getEncryptionInfoForEvent: a map from event id to result
        const eventToEncryptionInfoMap = new Map<string, EventEncryptionInfo>();

        beforeEach(() => {
            eventToEncryptionInfoMap.clear();

            const mockCrypto = {
                // a mocked version of getEncryptionInfoForEvent which will pick its result from `eventToEncryptionInfoMap`
                getEncryptionInfoForEvent: async (event: MatrixEvent) => eventToEncryptionInfoMap.get(event.getId()!)!,
            } as unknown as CryptoApi;
            client.getCrypto = () => mockCrypto;
        });

        it("shows a warning for an event from an unverified device", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.RED,
                shieldReason: EventShieldReason.UNSIGNED_DEVICE,
            } as EventEncryptionInfo);

            const { container } = getComponent();
            await flushPromises();

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be a warning shield
            expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(1);
            expect(container.querySelector('[data-testid="e2e-padlock"]')).toHaveAccessibleName(
                "Encrypted by a device not verified by its owner.",
            );
        });

        it("shows no shield for a verified event", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const { container } = getComponent();
            await flushPromises();

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be no warning
            expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(0);
        });

        it.each([
            [EventShieldReason.UNKNOWN, "Unknown error"],
            [EventShieldReason.UNVERIFIED_IDENTITY, "Encrypted by an unverified user."],
            [EventShieldReason.UNSIGNED_DEVICE, "Encrypted by a device not verified by its owner."],
            [EventShieldReason.UNKNOWN_DEVICE, "Encrypted by an unknown or deleted device."],
            [
                EventShieldReason.AUTHENTICITY_NOT_GUARANTEED,
                "The authenticity of this encrypted message can't be guaranteed on this device.",
            ],
            [EventShieldReason.MISMATCHED_SENDER_KEY, "Encrypted by an unverified session"],
            [EventShieldReason.SENT_IN_CLEAR, "Not encrypted"],
            [EventShieldReason.VERIFICATION_VIOLATION, "Sender's verified digital identity was reset"],
            [
                EventShieldReason.MISMATCHED_SENDER,
                "The sender of the event does not match the owner of the device that sent it.",
            ],
        ])("shows the correct reason code for %i (%s)", async (reasonCode: EventShieldReason, expectedText: string) => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.GREY,
                shieldReason: reasonCode,
            } as EventEncryptionInfo);

            const { container } = getComponent();
            await flushPromises();

            const e2eIcons = container.querySelectorAll('[data-testid="e2e-padlock"]');
            expect(e2eIcons).toHaveLength(1);
            expect(e2eIcons[0]).toHaveAccessibleName(expectedText);
        });

        it("shows the correct reason code for a forwarded message", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            // @ts-ignore assignment to private member
            mxEvent.keyForwardedBy = "@bob:example.org";
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.GREY,
                shieldReason: EventShieldReason.AUTHENTICITY_NOT_GUARANTEED,
            } as EventEncryptionInfo);

            const { container } = getComponent();

            const e2eIcon = await waitFor(() => getByTestId(container, "e2e-padlock"));
            expect(e2eIcon).toHaveAccessibleName(
                "@bob:example.org (@bob:example.org) shared this message since you were not in the room when it was sent.",
            );
        });

        describe("undecryptable event", () => {
            filterConsole("Error decrypting event");

            it("shows an undecryptable warning", async () => {
                mxEvent = mkEvent({
                    type: "m.room.encrypted",
                    room: room.roomId,
                    user: "@alice:example.org",
                    event: true,
                    content: {},
                });

                const mockCrypto = {
                    decryptEvent: async (_ev): Promise<IEventDecryptionResult> => {
                        throw new Error("can't decrypt");
                    },
                } as Parameters<MatrixEvent["attemptDecryption"]>[0];
                await mxEvent.attemptDecryption(mockCrypto);

                const { container } = getComponent();
                await flushPromises();

                const eventTiles = container.getElementsByClassName("mx_EventTile");
                expect(eventTiles).toHaveLength(1);

                expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(1);
                expect(container.querySelector('[data-testid="e2e-padlock"]')).toHaveAccessibleName(
                    "This message could not be decrypted",
                );
            });

            it("should not show a shield for previously-verified users", async () => {
                mxEvent = mkEvent({
                    type: "m.room.encrypted",
                    room: room.roomId,
                    user: "@alice:example.org",
                    event: true,
                    content: {},
                });

                const mockCrypto = {
                    decryptEvent: async (_ev): Promise<IEventDecryptionResult> => {
                        throw new Error("can't decrypt");
                    },
                } as Parameters<MatrixEvent["attemptDecryption"]>[0];
                await mxEvent.attemptDecryption(mockCrypto);
                mxEvent["_decryptionFailureReason"] = DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED;

                const { container } = getComponent();
                await act(flushPromises);

                const eventTiles = container.getElementsByClassName("mx_EventTile");
                expect(eventTiles).toHaveLength(1);

                expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(0);
            });
        });

        it("should update the warning when the event is edited", async () => {
            // we start out with an event from the trusted device
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const roomContext = getRoomContext(room, {});
            const { container, rerender } = render(<WrappedEventTile roomContext={roomContext} />);

            await flushPromises();

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be no warning
            expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(0);

            // then we replace the event with one from the unverified device
            const replacementEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(replacementEvent.getId()!, {
                shieldColour: EventShieldColour.RED,
                shieldReason: EventShieldReason.UNSIGNED_DEVICE,
            } as EventEncryptionInfo);

            await act(async () => {
                mxEvent.makeReplaced(replacementEvent);
                rerender(<WrappedEventTile roomContext={roomContext} />);
                await flushPromises;
            });

            // check it was updated
            expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(1);
            expect(container.querySelector('[data-testid="e2e-padlock"]')).toHaveAccessibleName(
                "Encrypted by a device not verified by its owner.",
            );
        });

        it("should update the warning when the event is replaced with an unencrypted one", async () => {
            // we start out with an event from the trusted device
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });

            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const roomContext = getRoomContext(room, { isRoomEncrypted: true });
            const { container, rerender } = render(<WrappedEventTile roomContext={roomContext} />);
            await flushPromises();

            const eventTiles = container.getElementsByClassName("mx_EventTile");
            expect(eventTiles).toHaveLength(1);

            // there should be no warning
            expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(0);

            // then we replace the event with an unencrypted one
            const replacementEvent = await mkMessage({
                msg: "msg2",
                user: "@alice:example.org",
                room: room.roomId,
                event: true,
            });

            await act(async () => {
                mxEvent.makeReplaced(replacementEvent);
                rerender(<WrappedEventTile roomContext={roomContext} />);
                await flushPromises;
            });

            // check it was updated
            expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(1);
            expect(container.querySelector('[data-testid="e2e-padlock"]')).toHaveAccessibleName("Not encrypted");
        });

        it.each([EventStatus.ENCRYPTING, EventStatus.NOT_SENT])(
            "does not show the unencrypted warning for %s events in encrypted rooms",
            (status) => {
                const event = makeOwnMessage();
                event.setStatus(status);
                const { container } = getComponent(
                    { mxEvent: event, eventSendStatus: status },
                    TimelineRenderingType.Room,
                    {
                        isRoomEncrypted: true,
                    },
                );

                expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(0);
            },
        );

        it("does not show the unencrypted warning for state events in encrypted rooms", () => {
            const stateEvent = mkEvent({
                event: true,
                type: EventType.RoomTopic,
                room: room.roomId,
                user: "@alice:example.org",
                skey: "",
                content: { topic: "Topic" },
            });
            const { container } = getComponent({ mxEvent: stateEvent }, TimelineRenderingType.Room, {
                isRoomEncrypted: true,
            });

            expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(0);
        });

        it("does not show the unencrypted warning for redacted events in encrypted rooms", () => {
            vi.spyOn(mxEvent, "isRedacted").mockReturnValue(true);
            const { container } = getComponent({}, TimelineRenderingType.Room, {
                isRoomEncrypted: true,
            });

            expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(0);
        });

        it("does not show the unencrypted warning for local-room events in encrypted rooms", () => {
            const localEvent = makeTimestampedMessage({ room: "local+room" });
            const { container } = getComponent({ mxEvent: localEvent }, TimelineRenderingType.Room, {
                isRoomEncrypted: true,
            });

            expect(container.querySelectorAll('[data-testid="e2e-padlock"]')).toHaveLength(0);
        });
    });

    it("should display the not encrypted status for an unencrypted event when the room becomes encrypted", async () => {
        vi.spyOn(client.getCrypto()!, "getEncryptionInfoForEvent").mockResolvedValue({
            shieldColour: EventShieldColour.NONE,
            shieldReason: null,
        });

        const { rerender } = getComponent();
        await flushPromises();
        // The room and the event are unencrypted, the tile should not show the not encrypted status
        expect(screen.queryByText("Not encrypted")).toBeNull();

        // The room is now encrypted
        rerender(
            <WrappedEventTile
                roomContext={getRoomContext(room, {
                    isRoomEncrypted: true,
                })}
            />,
        );

        // The event tile should now show the not encrypted status
        await waitFor(() => expect(screen.getByText("Not encrypted")).toBeInTheDocument());
    });

    it.each([
        [EventStatus.NOT_SENT, "Failed to send"],
        [EventStatus.SENDING, "Sending your message…"],
        [EventStatus.ENCRYPTING, "Encrypting your message…"],
    ])("should display %s status icon", (eventSendStatus, text) => {
        const ownEvent = mkMessage({
            room: room.roomId,
            user: client.getSafeUserId(),
            msg: "Hello world!",
            event: true,
        });
        const { getByRole } = getComponent({ mxEvent: ownEvent, eventSendStatus });

        expect(getByRole("status")).toHaveAccessibleName(text);
    });
});
