/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { EventType, type MatrixClient, MatrixEvent, MsgType, Room, type RoomMember } from "matrix-js-sdk/src/matrix";

import {
    JSONEventFactory,
    MessageEventFactory,
    pickFactory,
    renderTile,
    RoomCreateEventFactory,
} from "../../../src/events/EventTileFactory";
import SettingsStore from "../../../src/settings/SettingsStore";
import { createTestClient, mkEvent } from "../../test-utils";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { ModuleApi } from "../../../src/modules/Api";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";

const roomId = "!room:example.com";

function makeVerificationRequestEvent({ sender, to }: { sender: string; to: string }): MatrixEvent {
    return mkEvent({
        event: true,
        type: EventType.RoomMessage,
        user: sender,
        room: roomId,
        content: {
            msgtype: MsgType.KeyVerificationRequest,
            from_device: "DEVICE",
            methods: ["m.sas.v1"],
            to,
        },
    });
}

function makeRoomAvatarEvent(url = "mxc://example.com/avatar"): MatrixEvent {
    return new MatrixEvent({
        type: EventType.RoomAvatar,
        state_key: "",
        room_id: roomId,
        sender: "@alice:example.com",
        content: {
            url,
        },
    });
}

describe("pickFactory", () => {
    let client: MatrixClient;
    let room: Room;

    let createEventWithPredecessor: MatrixEvent;
    let createEventWithoutPredecessor: MatrixEvent;
    let dynamicPredecessorEvent: MatrixEvent;

    let utdEvent: MatrixEvent;
    let audioMessageEvent: MatrixEvent;

    beforeAll(() => {
        client = createTestClient();

        room = new Room(roomId, client, client.getSafeUserId());
        mocked(client.getRoom).mockImplementation((getRoomId: string): Room | null => {
            if (getRoomId === room.roomId) return room;
            return null;
        });

        createEventWithoutPredecessor = mkEvent({
            event: true,
            type: EventType.RoomCreate,
            user: client.getUserId()!,
            room: roomId,
            content: {
                creator: client.getUserId()!,
                room_version: "9",
            },
        });
        createEventWithPredecessor = mkEvent({
            event: true,
            type: EventType.RoomCreate,
            user: client.getUserId()!,
            room: roomId,
            content: {
                creator: client.getUserId()!,
                room_version: "9",
                predecessor: {
                    room_id: "roomid1",
                    event_id: null,
                },
            },
        });
        dynamicPredecessorEvent = mkEvent({
            event: true,
            type: EventType.RoomPredecessor,
            user: client.getUserId()!,
            room: roomId,
            skey: "",
            content: {
                predecessor_room_id: "roomid2",
                last_known_event_id: null,
            },
        });
        audioMessageEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId()!,
            room: roomId,
            content: {
                msgtype: MsgType.Audio,
            },
        });
        utdEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId()!,
            room: roomId,
            content: {
                msgtype: "m.bad.encrypted",
            },
        });
    });

    it("should return JSONEventFactory for a no-op m.room.power_levels event", () => {
        const event = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            state_key: "",
            content: {},
            sender: client.getUserId()!,
            room_id: roomId,
        });
        expect(pickFactory(event, client, true)).toBe(JSONEventFactory);
    });

    describe("when showing hidden events", () => {
        it("should return a JSONEventFactory for a room create event without predecessor", () => {
            room.currentState.events.set(
                EventType.RoomCreate,
                new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
            );
            room.currentState.events.set(EventType.RoomPredecessor, new Map());
            expect(pickFactory(createEventWithoutPredecessor, client, true)).toBe(JSONEventFactory);
        });

        it("should return a MessageEventFactory for an audio message event", () => {
            expect(pickFactory(audioMessageEvent, client, true)).toBe(MessageEventFactory);
        });
    });

    describe("when not showing hidden events", () => {
        describe("without dynamic predecessor support", () => {
            beforeEach(() => {
                jest.spyOn(SettingsStore, "getValue").mockReset();
            });

            it("should return undefined for a room without predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
                );
                room.currentState.events.set(EventType.RoomPredecessor, new Map());
                expect(pickFactory(createEventWithoutPredecessor, client, false)).toBeUndefined();
            });

            it("should return a RoomCreateFactory for a room with fixed predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithPredecessor.getStateKey()!, createEventWithPredecessor]]),
                );
                room.currentState.events.set(EventType.RoomPredecessor, new Map());
                expect(pickFactory(createEventWithPredecessor, client, false)).toBe(RoomCreateEventFactory);
            });

            it("should return undefined for a room with dynamic predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
                );
                room.currentState.events.set(
                    EventType.RoomPredecessor,
                    new Map([[dynamicPredecessorEvent.getStateKey()!, dynamicPredecessorEvent]]),
                );
                expect(pickFactory(createEventWithoutPredecessor, client, false)).toBeUndefined();
            });
        });

        describe("with dynamic predecessor support", () => {
            beforeEach(() => {
                jest.spyOn(SettingsStore, "getValue")
                    .mockReset()
                    .mockImplementation((settingName) => settingName === "feature_dynamic_room_predecessors");
            });

            it("should return undefined for a room without predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
                );
                room.currentState.events.set(EventType.RoomPredecessor, new Map());
                expect(pickFactory(createEventWithoutPredecessor, client, false)).toBeUndefined();
            });

            it("should return a RoomCreateFactory for a room with fixed predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithPredecessor.getStateKey()!, createEventWithPredecessor]]),
                );
                room.currentState.events.set(EventType.RoomPredecessor, new Map());
                expect(pickFactory(createEventWithPredecessor, client, false)).toBe(RoomCreateEventFactory);
            });

            it("should return a RoomCreateFactory for a room with dynamic predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
                );
                room.currentState.events.set(
                    EventType.RoomPredecessor,
                    new Map([[dynamicPredecessorEvent.getStateKey()!, dynamicPredecessorEvent]]),
                );
                expect(pickFactory(createEventWithoutPredecessor, client, false)).toBe(RoomCreateEventFactory);
            });
        });

        it("should return a MessageEventFactory for an audio message event", () => {
            expect(pickFactory(audioMessageEvent, client, false)).toBe(MessageEventFactory);
        });

        it("should return a MessageEventFactory for a UTD event", () => {
            expect(pickFactory(utdEvent, client, false)).toBe(MessageEventFactory);
        });

        it("should not render key verification requests which do not involve the current user", () => {
            const event = makeVerificationRequestEvent({
                sender: "@alice:example.com",
                to: "@bob:example.com",
            });

            expect(pickFactory(event, client, false)).toBeUndefined();
        });
    });
});

describe("renderTile", () => {
    let client: MatrixClient;
    let originalRenderMessage: typeof ModuleApi.instance.customComponents.renderMessage;

    beforeEach(() => {
        client = createTestClient();
        originalRenderMessage = ModuleApi.instance.customComponents.renderMessage;
    });

    afterEach(() => {
        ModuleApi.instance.customComponents.renderMessage = originalRenderMessage;
        jest.restoreAllMocks();
    });

    it("rendering a tile defers to the module API", () => {
        ModuleApi.instance.customComponents.renderMessage = jest.fn();

        const messageEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId()!,
            room: roomId,
            content: {
                msgtype: MsgType.Text,
            },
        });

        renderTile(TimelineRenderingType.Room, { mxEvent: messageEvent, showHiddenEvents: false }, client);

        expect(ModuleApi.instance.customComponents.renderMessage).toHaveBeenCalledWith(
            {
                mxEvent: messageEvent,
            },
            expect.any(Function),
        );
    });

    it("rendering a tile for a message of unknown type defers to the module API", () => {
        ModuleApi.instance.customComponents.renderMessage = jest.fn();

        const messageEvent = mkEvent({
            event: true,
            type: "weird.type",
            user: client.getUserId()!,
            room: roomId,
            content: {
                msgtype: MsgType.Text,
            },
        });

        renderTile(TimelineRenderingType.Room, { mxEvent: messageEvent, showHiddenEvents: false }, client);

        expect(ModuleApi.instance.customComponents.renderMessage).toHaveBeenCalledWith({
            mxEvent: messageEvent,
        });
    });

    it("renders an incoming key verification request with the wrapped shared-components view", () => {
        const sender = "@alice:example.com";
        const room = new Room(roomId, client, client.getSafeUserId());
        jest.spyOn(room, "getMember").mockImplementation((userId: string) => {
            if (userId === sender) return { name: "Alice" } as RoomMember;
            return null;
        });
        mocked(client.getRoom).mockReturnValue(room);

        const verificationRequestEvent = makeVerificationRequestEvent({
            sender,
            to: client.getUserId()!,
        });

        const tile = renderTile(
            TimelineRenderingType.Room,
            { mxEvent: verificationRequestEvent, showHiddenEvents: false },
            client,
        );
        if (!tile) throw new Error("Expected a key verification request tile");

        render(React.createElement(MatrixClientContext.Provider, { value: client }, tile));

        expect(screen.getByText("Alice wants to verify")).toBeInTheDocument();
        expect(screen.getByText("Alice (@alice:example.com)")).toBeInTheDocument();
    });

    it("renders an outgoing key verification request with the wrapped shared-components view", () => {
        const recipient = "@alice:example.com";
        const room = new Room(roomId, client, client.getSafeUserId());
        jest.spyOn(room, "getMember").mockImplementation((userId: string) => {
            if (userId === recipient) return { name: "Alice" } as RoomMember;
            return null;
        });
        mocked(client.getRoom).mockReturnValue(room);

        const verificationRequestEvent = makeVerificationRequestEvent({
            sender: client.getUserId()!,
            to: recipient,
        });

        const tile = renderTile(
            TimelineRenderingType.Room,
            { mxEvent: verificationRequestEvent, showHiddenEvents: false },
            client,
        );
        if (!tile) throw new Error("Expected a key verification request tile");

        render(React.createElement(MatrixClientContext.Provider, { value: client }, tile));

        expect(screen.getByText("You sent a verification request")).toBeInTheDocument();
        expect(screen.getByText("Alice (@alice:example.com)")).toBeInTheDocument();
    });

    it("throws when a key verification request tile is rendered without a client context", () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        const verificationRequestEvent = makeVerificationRequestEvent({
            sender: client.getUserId()!,
            to: "@alice:example.com",
        });

        const tile = renderTile(
            TimelineRenderingType.Room,
            { mxEvent: verificationRequestEvent, showHiddenEvents: false },
            client,
        );
        if (!tile) throw new Error("Expected a key verification request tile");

        expect(() => render(tile)).toThrow("Attempting to render verification request without a client context!");
    });

    it("renders room avatar events with the wrapped shared-components view", () => {
        const room = new Room(roomId, client, client.getSafeUserId());
        room.name = "General";
        room.currentState.setStateEvents([
            new MatrixEvent({
                type: EventType.RoomCreate,
                state_key: "",
                room_id: room.roomId,
                sender: client.getUserId()!,
                content: {
                    creator: client.getUserId()!,
                    room_version: "9",
                },
            }),
        ]);
        mocked(client.getRoom).mockReturnValue(room);
        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn().mockReturnValue(null),
        } as unknown as DMRoomMap);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client);
        const roomAvatarEvent = makeRoomAvatarEvent();
        roomAvatarEvent.sender = { name: "Alice" } as MatrixEvent["sender"];

        const tile = renderTile(
            TimelineRenderingType.Room,
            { mxEvent: roomAvatarEvent, showHiddenEvents: false },
            client,
        );
        if (!tile) throw new Error("Expected a room avatar event tile");

        render(React.createElement(MatrixClientContext.Provider, { value: client }, tile));

        expect(screen.getByText("Alice changed the room avatar to")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Alice changed the avatar for General" })).toBeInTheDocument();
    });
});
