/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "jest-matrix-react";
import { mocked } from "jest-mock";
import {
    EventStatus,
    EventType,
    type IEventDecryptionResult,
    type MatrixClient,
    MatrixEvent,
    MatrixEventEvent,
    MsgType,
    NotificationCountType,
    PendingEventOrdering,
    RelationType,
    type Relations,
    Room,
    TweakName,
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

import EventTile, { type EventTileProps } from "../../../../../src/components/views/rooms/EventTile";
import * as EventTileFactory from "../../../../../src/events/EventTileFactory";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { type RoomContextType, TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { filterConsole, flushPromises, getRoomContext, mkEvent, mkMessage, stubClient } from "../../../../test-utils";
import { mkThread } from "../../../../test-utils/threads";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import dis from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import PinningUtils from "../../../../../src/utils/PinningUtils";
import { Layout } from "../../../../../src/settings/enums/Layout";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import EditorStateTransfer from "../../../../../src/utils/EditorStateTransfer";
import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import PlatformPeg from "../../../../../src/PlatformPeg";
import { SDKContextClass } from "../../../../../src/contexts/SDKContextClass.ts";
import { SDKContext } from "../../../../../src/contexts/SDKContext.ts";

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

function expectTileClass(container: HTMLElement, className: string): void {
    expect(getTile(container)).toHaveClass(className);
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
        on: jest.fn(),
        off: jest.fn(),
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
        return (
            <MatrixClientContext.Provider value={client}>
                <ScopedRoomContextProvider {...props.roomContext}>
                    <EventTile
                        mxEvent={mxEvent}
                        replacingEventId={mxEvent.replacingEventId()}
                        {...(props.eventTilePropertyOverrides ?? {})}
                    />
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

    function WrappedEventTiles(props: { events: MatrixEvent[]; editEvent?: MatrixEvent }) {
        const roomContext = getRoomContext(room, {
            timelineRenderingType: TimelineRenderingType.Room,
        });

        return (
            <MatrixClientContext.Provider value={client}>
                <ScopedRoomContextProvider {...roomContext}>
                    {props.events.map((event) => (
                        <EventTile
                            key={event.getId()}
                            mxEvent={event}
                            replacingEventId={event.replacingEventId()}
                            editState={
                                props.editEvent?.getId() === event.getId() ? new EditorStateTransfer(event) : undefined
                            }
                        />
                    ))}
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>
        );
    }

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.safeGet();
        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn().mockReturnValue(undefined),
        } as unknown as DMRoomMap);

        room = new Room(ROOM_ID, client, client.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
            timelineSupport: true,
        });

        jest.spyOn(client, "getRoom").mockReturnValue(room);
        jest.spyOn(client, "decryptEventIfNeeded").mockResolvedValue();
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);

        mxEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Hello world!",
            event: true,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("layout and tile attributes", () => {
        it.each([
            ["last", { last: true }, "mx_EventTile_last"],
            ["lastInSection", { lastInSection: true }, "mx_EventTile_lastInSection"],
            ["contextual", { contextual: true }, "mx_EventTile_contextual"],
            ["isSelectedEvent", { isSelectedEvent: true }, "mx_EventTile_selected"],
            ["hideSender", { hideSender: true }, "mx_EventTile_noSender"],
            ["isTwelveHour", { isTwelveHour: true }, "mx_EventTile_12hr"],
        ] as const)("adds the %s class", (_propName, overrides, className) => {
            const { container } = getComponent(overrides);

            expectTileClass(container, className);
        });

        it("marks events from other users as non-self events", () => {
            const { container } = getComponent();

            expect(getTile(container)).toHaveAttribute("data-self", "false");
        });

        it("marks events from the current user as self events", () => {
            const ownEvent = makeOwnMessage();
            const { container } = getComponent({ mxEvent: ownEvent });

            expect(getTile(container)).toHaveAttribute("data-self", "true");
        });

        it("exposes the rendered event id in room timelines", () => {
            const { container } = getComponent();

            expect(getTile(container)).toHaveAttribute("data-event-id", mxEvent.getId());
        });

        it("renders the event line inside the tile", () => {
            const { container } = getComponent();

            expect(getTile(container)).toContainElement(getLine(container));
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

    describe("rendering root attributes", () => {
        type RootAttribute =
            | "data-scroll-tokens"
            | "data-layout"
            | "data-shape"
            | "data-self"
            | "data-event-id"
            | "data-has-reply";

        it.each([
            [
                TimelineRenderingType.Room,
                ["data-scroll-tokens", "data-layout", "data-self", "data-event-id", "data-has-reply"],
                ["data-shape"],
            ],
            [
                TimelineRenderingType.Thread,
                ["data-scroll-tokens", "data-layout", "data-self", "data-event-id", "data-has-reply"],
                ["data-shape"],
            ],
            [
                TimelineRenderingType.ThreadsList,
                ["data-scroll-tokens", "data-layout", "data-shape", "data-self", "data-has-reply"],
                ["data-event-id"],
            ],
            [
                TimelineRenderingType.Notification,
                ["data-scroll-tokens", "data-layout", "data-shape", "data-self", "data-has-reply"],
                ["data-event-id"],
            ],
            [
                TimelineRenderingType.File,
                ["data-scroll-tokens"],
                ["data-layout", "data-shape", "data-self", "data-event-id", "data-has-reply"],
            ],
        ] as const)(
            "sets root attributes for %s rendering",
            (renderingType, expectedPresentAttributes, expectedAbsentAttributes) => {
                const { container } = getComponent({}, renderingType);
                const tile = getTile(container);
                const expectedValues: Record<RootAttribute, string> = {
                    "data-scroll-tokens": mxEvent.getId()!,
                    "data-layout": Layout.Group,
                    "data-shape": renderingType,
                    "data-self": "false",
                    "data-event-id": mxEvent.getId()!,
                    "data-has-reply": "false",
                };

                for (const attribute of expectedPresentAttributes) {
                    expect(tile).toHaveAttribute(attribute, expectedValues[attribute]);
                }

                for (const attribute of expectedAbsentAttributes) {
                    expect(tile).not.toHaveAttribute(attribute);
                }
            },
        );
    });

    describe("message type classes", () => {
        it("adds media and image classes for image messages", () => {
            const imageEvent = mkEvent({
                event: true,
                type: EventType.RoomMessage,
                room: room.roomId,
                user: "@alice:example.org",
                content: {
                    msgtype: MsgType.Image,
                    body: "image.png",
                    url: "mxc://example.org/image",
                    info: {
                        mimetype: "image/png",
                        w: 100,
                        h: 100,
                        size: 1234,
                    },
                },
            });
            const { container } = getComponent({ mxEvent: imageEvent });

            expect(getLine(container)).toHaveClass("mx_EventTile_mediaLine");
            expect(getLine(container)).toHaveClass("mx_EventTile_image");
        });

        it("adds emote classes for emote messages", () => {
            const emoteEvent = mkEvent({
                event: true,
                type: EventType.RoomMessage,
                room: room.roomId,
                user: "@alice:example.org",
                content: {
                    msgtype: MsgType.Emote,
                    body: "waves",
                },
            });
            const { container } = getComponent({ mxEvent: emoteEvent });

            expect(getTile(container)).toHaveClass("mx_EventTile_emote");
            expect(getLine(container)).toHaveClass("mx_EventTile_emote");
        });

        it("adds media and sticker classes for sticker events", () => {
            const stickerEvent = mkEvent({
                event: true,
                type: EventType.Sticker,
                room: room.roomId,
                user: "@alice:example.org",
                content: {
                    body: "sticker.png",
                    url: "mxc://example.org/sticker",
                    info: {
                        mimetype: "image/png",
                        w: 100,
                        h: 100,
                        size: 1234,
                    },
                },
            });
            const { container } = getComponent({ mxEvent: stickerEvent });

            expect(getLine(container)).toHaveClass("mx_EventTile_mediaLine");
            expect(getLine(container)).toHaveClass("mx_EventTile_sticker");
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

        it("shows the timestamp when the tile is hovered", () => {
            const { container } = getComponent();

            expect(container.querySelector(".mx_MessageTimestamp")).toBeNull();

            fireEvent.mouseEnter(getTile(container));

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

        it("renders a placeholder timestamp in IRC layout", () => {
            const { container } = getComponent({ layout: Layout.IRC });
            const timestamp = container.querySelector(".mx_MessageTimestamp");

            expect(timestamp).not.toBeNull();
            expect(timestamp?.tagName).toBe("SPAN");
        });

        it("dispatches a room view when the linked timestamp is clicked", () => {
            jest.spyOn(dis, "dispatch").mockImplementation(() => {});
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
        it("shows sender and avatar in room timelines", () => {
            const { container } = getComponent();

            expect(container.querySelector(".mx_DisambiguatedProfile")).not.toBeNull();
            expect(container.querySelector(".mx_EventTile_avatar")).not.toBeNull();
        });

        it("hides sender and avatar for continuation events in room timelines", () => {
            const { container } = getComponent({ continuation: true });

            expectTileClass(container, "mx_EventTile_continuation");
            expect(container.querySelector(".mx_DisambiguatedProfile")).toBeNull();
            expect(container.querySelector(".mx_EventTile_avatar")).toBeNull();
        });

        it("hides sender but keeps avatar when sender display is disabled", () => {
            const { container } = getComponent({ hideSender: true });

            expectTileClass(container, "mx_EventTile_noSender");
            expect(container.querySelector(".mx_DisambiguatedProfile")).toBeNull();
            expect(container.querySelector(".mx_EventTile_avatar")).not.toBeNull();
        });

        it("renders sender details as a permalink in file timelines", () => {
            const { container } = getComponent({}, TimelineRenderingType.File);
            const senderDetailsLink = container.querySelector(".mx_EventTile_senderDetailsLink");

            expect(senderDetailsLink).not.toBeNull();
            expect(senderDetailsLink).toContainElement(container.querySelector(".mx_DisambiguatedProfile"));
            expect(senderDetailsLink).toContainElement(container.querySelector(".mx_EventTile_avatar"));
        });

        it("renders sender details in thread timelines", () => {
            const { container } = getComponent({}, TimelineRenderingType.Thread);
            const senderDetails = container.querySelector(".mx_EventTile_senderDetails");

            expect(senderDetails).not.toBeNull();
            expect(senderDetails).toContainElement(container.querySelector(".mx_DisambiguatedProfile"));
            expect(senderDetails).toContainElement(container.querySelector(".mx_EventTile_avatar"));
        });

        it("keeps sender and avatar when only the layout prop is set to bubble", () => {
            const { container } = getComponent({ layout: Layout.Bubble });

            expect(container.querySelector(".mx_DisambiguatedProfile")).not.toBeNull();
            expect(container.querySelector(".mx_EventTile_avatar")).not.toBeNull();
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
            expect(container.querySelector(".mx_EventTile_avatar")).not.toBeNull();
        });

        it("renders the notification avatar independently from the sender details", () => {
            const { container } = getComponent({}, TimelineRenderingType.Notification);
            const details = container.querySelector<HTMLElement>(".mx_EventTile_details");
            const avatar = container.querySelector<HTMLElement>(".mx_EventTile_avatar");

            expect(details).not.toBeNull();
            expect(avatar).not.toBeNull();
            expect(details).not.toContainElement(avatar);
        });
    });

    describe("continuation rendering", () => {
        it.each([TimelineRenderingType.Room, TimelineRenderingType.Search, TimelineRenderingType.Thread])(
            "keeps continuation styling in %s timelines",
            (renderingType) => {
                const { container } = getComponent({ continuation: true }, renderingType);

                expect(getTile(container)).toHaveClass("mx_EventTile_continuation");
            },
        );

        it.each([TimelineRenderingType.File, TimelineRenderingType.Notification, TimelineRenderingType.ThreadsList])(
            "drops continuation styling in %s timelines when not using bubble layout",
            (renderingType) => {
                const { container } = getComponent({ continuation: true }, renderingType);

                expect(getTile(container)).not.toHaveClass("mx_EventTile_continuation");
            },
        );

        it.each([TimelineRenderingType.File, TimelineRenderingType.Notification, TimelineRenderingType.ThreadsList])(
            "keeps continuation styling in %s timelines when using bubble layout",
            (renderingType) => {
                const { container } = getComponent({ continuation: true, layout: Layout.Bubble }, renderingType);

                expect(getTile(container)).toHaveClass("mx_EventTile_continuation");
            },
        );
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
            const getRelationsForEvent = jest.fn().mockReturnValue(null);

            getComponent({ showReactions: true, getRelationsForEvent });

            expect(getRelationsForEvent).toHaveBeenCalledWith(mxEvent.getId(), "m.annotation", "m.reaction");
        });

        it("does not get annotation relations when reactions are disabled", () => {
            const getRelationsForEvent = jest.fn().mockReturnValue(null);

            getComponent({ getRelationsForEvent });

            expect(getRelationsForEvent).not.toHaveBeenCalled();
        });

        it("refreshes annotation relations when reaction relations are created", () => {
            const getRelationsForEvent = jest.fn().mockReturnValue(null);
            getComponent({ showReactions: true, getRelationsForEvent });
            getRelationsForEvent.mockClear();

            act(() => {
                mxEvent.emit(MatrixEventEvent.RelationsCreated, "m.annotation", "m.reaction");
            });

            expect(getRelationsForEvent).toHaveBeenCalledWith(mxEvent.getId(), "m.annotation", "m.reaction");
        });

        it("does not refresh annotation relations for unrelated relations", () => {
            const getRelationsForEvent = jest.fn().mockReturnValue(null);
            getComponent({ showReactions: true, getRelationsForEvent });
            getRelationsForEvent.mockClear();

            act(() => {
                mxEvent.emit(MatrixEventEvent.RelationsCreated, "m.reference", "m.room.message");
            });

            expect(getRelationsForEvent).not.toHaveBeenCalled();
        });

        it("does not render reactions for redacted events", () => {
            const getRelationsForEvent = jest.fn().mockReturnValue(null);
            const { container } = getComponent({ showReactions: true, getRelationsForEvent, isRedacted: true });

            expect(container.querySelector(".mx_ReactionsRow")).toBeNull();
        });

        it("renders a footer for pinned messages", () => {
            jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            const { container } = getComponent();

            expect(container.querySelector(".mx_EventTile_footer")).not.toBeNull();
            expect(screen.getByText("Pinned message")).toBeInTheDocument();
        });

        it("renders the IRC footer inside the event line", () => {
            jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            const { container } = getComponent({ layout: Layout.IRC });

            expect(getLine(container).querySelector(".mx_EventTile_footer")).not.toBeNull();
            expect(getTile(container).querySelector(":scope > .mx_EventTile_footer")).toBeNull();
        });

        it("renders a bubble footer for an own pinned message", () => {
            jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            const ownEvent = makeOwnMessage();
            const { container } = getComponent({ mxEvent: ownEvent, layout: Layout.Bubble });
            const footer = container.querySelector(".mx_EventTile_footer");

            expect(footer).not.toBeNull();
            expect(footer).toHaveTextContent("Pinned message");
        });

        it("renders relation groups and deduplicates reactions from the same sender", () => {
            const bobReaction1 = makeReactionEvent(room.roomId, mxEvent.getId()!, "@bob:example.org", "👍");
            const bobReaction2 = makeReactionEvent(room.roomId, mxEvent.getId()!, "@bob:example.org", "👍");
            const getRelationsForEvent = jest
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
            const getRelationsForEvent = jest.fn().mockReturnValue(
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

        it("renders the message action bar when the tile is hovered", () => {
            const { container } = getComponent();

            fireEvent.mouseEnter(getTile(container));

            expect(container.querySelector(".mx_MessageActionBar")).not.toBeNull();
        });

        it("renders the message action bar when the tile receives keyboard focus", () => {
            const matches = HTMLElement.prototype.matches;
            jest.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (this: HTMLElement, selector) {
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
            jest.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (this: HTMLElement, selector) {
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

        it("does not render the message action bar on hover when exporting", () => {
            const { container } = getComponent({ forExport: true });

            fireEvent.mouseEnter(getTile(container));

            expect(container.querySelector(".mx_MessageActionBar")).toBeNull();
        });

        it("does not render the message action bar on hover while editing", () => {
            const { container } = getComponent({ editState: {} as EventTileProps["editState"] });

            fireEvent.mouseEnter(getTile(container));

            expect(container.querySelector(".mx_MessageActionBar")).toBeNull();
        });
    });

    describe("context menu", () => {
        it("renders the message context menu when the event line is right-clicked", async () => {
            const { container } = getComponent();

            fireEvent.contextMenu(getLine(container), { clientX: 1, clientY: 2 });

            expect(await screen.findByTestId("mx_MessageContextMenu")).toBeInTheDocument();
        });

        it("marks the tile selected when the context menu is open", async () => {
            const { container } = getComponent();
            const tile = getTile(container);

            fireEvent.contextMenu(getLine(container), { clientX: 1, clientY: 2 });

            expect(await screen.findByTestId("mx_MessageContextMenu")).toBeInTheDocument();
            expect(tile).toHaveClass("mx_EventTile_selected");
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
            jest.spyOn(PlatformPeg, "get").mockReturnValue({
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
        it("marks non-reply events as having no reply", () => {
            const { container } = getComponent();

            expect(getTile(container)).toHaveAttribute("data-has-reply", "false");
            expect(container.querySelector(".mx_ReplyChain_wrapper")).toBeNull();
        });

        it("marks reply events as having a reply chain", () => {
            const replyEvent = makeReplyEvent(room.roomId);
            const { container } = getComponent({ mxEvent: replyEvent });

            expect(getTile(container)).toHaveAttribute("data-has-reply", "true");
            expect(container.querySelector(".mx_ReplyChain_wrapper")).not.toBeNull();
        });

        it("does not render the reply chain for redacted reply events", () => {
            const replyEvent = makeReplyEvent(room.roomId);
            jest.spyOn(replyEvent, "isRedacted").mockReturnValue(true);
            const { container } = getComponent({ mxEvent: replyEvent });

            expect(getTile(container)).toHaveAttribute("data-has-reply", "false");
            expect(container.querySelector(".mx_ReplyChain_wrapper")).toBeNull();
        });
    });

    describe("EventTile thread summary", () => {
        beforeEach(() => {
            jest.spyOn(client, "supportsThreads").mockReturnValue(true);
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
            jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            getComponent({}, TimelineRenderingType.Thread);

            expect(screen.getByText("Pinned message")).toBeInTheDocument();
        });
    });

    describe("EventTile renderingType: File", () => {
        it("should not display the pinned message badge", async () => {
            jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
            getComponent({}, TimelineRenderingType.File);

            expect(screen.queryByText("Pinned message")).not.toBeInTheDocument();
        });
    });

    describe("EventTile renderingType: default", () => {
        it.each([[Layout.Group], [Layout.Bubble], [Layout.IRC]])(
            "should display the pinned message badge",
            async (layout) => {
                jest.spyOn(PinningUtils, "isPinned").mockReturnValue(true);
                getComponent({ layout });

                expect(screen.getByText("Pinned message")).toBeInTheDocument();
            },
        );

        it("renders the tile error fallback when tile rendering throws", async () => {
            jest.spyOn(console, "error").mockImplementation(() => {});
            jest.spyOn(EventTileFactory, "renderTile").mockImplementation(() => {
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

        it("updates msgtype-derived tile classes when an edit changes msgtype to m.emote", async () => {
            const { container } = getComponent();
            expect(container.querySelector(".mx_EventTile_emote")).toBeNull();

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

            await waitFor(() => expect(container.querySelector(".mx_EventTile_emote")).not.toBeNull());
        });
    });

    describe("EventTile in the right panel", () => {
        it("renders the room name for notifications", () => {
            const { container } = getComponent({}, TimelineRenderingType.Notification);
            expect(container.getElementsByClassName("mx_EventTile_details")[0]).toHaveTextContent(
                "@alice:example.org in !roomId:example.org",
            );
        });

        it("renders the sender for the thread list", () => {
            const { container } = getComponent({}, TimelineRenderingType.ThreadsList);
            expect(container.getElementsByClassName("mx_EventTile_details")[0]).toHaveTextContent("@alice:example.org");
        });

        it("renders the shared redacted body for thread previews", () => {
            jest.spyOn(mxEvent, "isRedacted").mockReturnValue(true);
            jest.spyOn(mxEvent, "getUnsigned").mockReturnValue({
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
            jest.spyOn(dis, "dispatch");

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
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0]).toHaveAccessibleName(
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
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);
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

            const e2eIcons = container.getElementsByClassName("mx_EventTile_e2eIcon");
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

                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0]).toHaveAccessibleName(
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

                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);
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
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);

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
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0]).toHaveAccessibleName(
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
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);

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
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(1);
            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")[0]).toHaveAccessibleName("Not encrypted");
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

                expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);
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

            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);
        });

        it("does not show the unencrypted warning for redacted events in encrypted rooms", () => {
            jest.spyOn(mxEvent, "isRedacted").mockReturnValue(true);
            const { container } = getComponent({}, TimelineRenderingType.Room, {
                isRoomEncrypted: true,
            });

            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);
        });

        it("does not show the unencrypted warning for local-room events in encrypted rooms", () => {
            const localEvent = makeTimestampedMessage({ room: "local+room" });
            const { container } = getComponent({ mxEvent: localEvent }, TimelineRenderingType.Room, {
                isRoomEncrypted: true,
            });

            expect(container.getElementsByClassName("mx_EventTile_e2eIcon")).toHaveLength(0);
        });
    });

    describe("event highlighting", () => {
        const isHighlighted = (container: HTMLElement): boolean =>
            !!container.getElementsByClassName("mx_EventTile_highlight").length;

        beforeEach(() => {
            mocked(client.getPushActionsForEvent).mockReturnValue(null);
        });

        it("does not highlight message where message matches no push actions", () => {
            const { container } = getComponent();

            expect(client.getPushActionsForEvent).toHaveBeenCalledWith(mxEvent);
            expect(isHighlighted(container)).toBeFalsy();
        });

        it("does not highlight when message's push actions does not have a highlight tweak", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: {} });
            const { container } = getComponent();

            expect(isHighlighted(container)).toBeFalsy();
        });

        it("does not highlight when message's push actions have a highlight tweak but message has been redacted", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({
                notify: true,
                tweaks: { [TweakName.Highlight]: true },
            });
            const { container } = getComponent({ isRedacted: true });

            expect(isHighlighted(container)).toBeFalsy();
        });

        it("does not highlight when exporting", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({
                notify: true,
                tweaks: { [TweakName.Highlight]: true },
            });
            const { container } = getComponent({ forExport: true });

            expect(client.getPushActionsForEvent).not.toHaveBeenCalled();
            expect(isHighlighted(container)).toBeFalsy();
        });

        it.each([TimelineRenderingType.Notification, TimelineRenderingType.ThreadsList])(
            "does not highlight in %s timelines",
            (renderingType) => {
                mocked(client.getPushActionsForEvent).mockReturnValue({
                    notify: true,
                    tweaks: { [TweakName.Highlight]: true },
                });
                const { container } = getComponent({}, renderingType);

                expect(client.getPushActionsForEvent).not.toHaveBeenCalled();
                expect(isHighlighted(container)).toBeFalsy();
            },
        );

        it("does not highlight events sent by the current user", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({
                notify: true,
                tweaks: { [TweakName.Highlight]: true },
            });
            const ownEvent = makeOwnMessage();
            const { container } = getComponent({ mxEvent: ownEvent });

            expect(client.getPushActionsForEvent).toHaveBeenCalledWith(ownEvent);
            expect(isHighlighted(container)).toBeFalsy();
        });

        it("highlights when message's push actions have a highlight tweak", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({
                notify: true,
                tweaks: { [TweakName.Highlight]: true },
            });
            const { container } = getComponent();

            expect(isHighlighted(container)).toBeTruthy();
        });

        describe("when a message has been edited", () => {
            let editingEvent: MatrixEvent;

            beforeEach(() => {
                editingEvent = new MatrixEvent({
                    type: "m.room.message",
                    room_id: ROOM_ID,
                    sender: "@alice:example.org",
                    content: {
                        "msgtype": "m.text",
                        "body": "* edited body",
                        "m.new_content": {
                            msgtype: "m.text",
                            body: "edited body",
                        },
                        "m.relates_to": {
                            rel_type: "m.replace",
                            event_id: mxEvent.getId(),
                        },
                    },
                });
                mxEvent.makeReplaced(editingEvent);
            });

            it("does not highlight message where no version of message matches any push actions", () => {
                const { container } = getComponent();

                // get push actions for both events
                expect(client.getPushActionsForEvent).toHaveBeenCalledWith(mxEvent);
                expect(client.getPushActionsForEvent).toHaveBeenCalledWith(editingEvent);
                expect(isHighlighted(container)).toBeFalsy();
            });

            it(`does not highlight when no version of message's push actions have a highlight tweak`, () => {
                mocked(client.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: {} });
                const { container } = getComponent();

                expect(isHighlighted(container)).toBeFalsy();
            });

            it(`highlights when previous version of message's push actions have a highlight tweak`, () => {
                mocked(client.getPushActionsForEvent).mockImplementation((event: MatrixEvent) => {
                    if (event === mxEvent) {
                        return { notify: true, tweaks: { [TweakName.Highlight]: true } };
                    }
                    return { notify: false, tweaks: {} };
                });
                const { container } = getComponent();

                expect(isHighlighted(container)).toBeTruthy();
            });

            it(`highlights when new version of message's push actions have a highlight tweak`, () => {
                mocked(client.getPushActionsForEvent).mockImplementation((event: MatrixEvent) => {
                    if (event === editingEvent) {
                        return { notify: true, tweaks: { [TweakName.Highlight]: true } };
                    }
                    return { notify: false, tweaks: {} };
                });
                const { container } = getComponent();

                expect(isHighlighted(container)).toBeTruthy();
            });
        });
    });

    it("does not leave a stale message action bar when switching edited events", async () => {
        const firstEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "First message",
            event: true,
        });
        const secondEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Second message",
            event: true,
        });
        const events = [firstEvent, secondEvent];

        const matches = jest.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (
            this: HTMLElement,
            selector: string,
        ) {
            if (selector === ":focus-visible") {
                return true;
            }
            return Element.prototype.matches.call(this, selector);
        });

        const { container, rerender } = render(<WrappedEventTiles events={events} editEvent={firstEvent} />, {
            wrapper: ({ children }) => (
                <SDKContext.Provider value={SDKContextClass.instance}>{children}</SDKContext.Provider>
            ),
        });
        const editingTile = container.querySelector(".mx_EventTile_isEditing");

        expect(editingTile).not.toBeNull();
        fireEvent.focusIn(editingTile!);
        expect(container.querySelectorAll(".mx_MessageActionBar")).toHaveLength(0);

        rerender(<WrappedEventTiles events={events} editEvent={secondEvent} />);

        await waitFor(() => {
            expect(container.querySelectorAll(".mx_EventTile_isEditing")).toHaveLength(1);
            expect(container.querySelectorAll(".mx_MessageActionBar")).toHaveLength(0);
        });

        matches.mockRestore();
    });

    it("should display the not encrypted status for an unencrypted event when the room becomes encrypted", async () => {
        jest.spyOn(client.getCrypto()!, "getEncryptionInfoForEvent").mockResolvedValue({
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
