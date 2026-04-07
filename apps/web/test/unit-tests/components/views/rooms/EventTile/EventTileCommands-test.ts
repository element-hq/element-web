/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { PendingEventOrdering, Room, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { Action } from "../../../../../../src/dispatcher/actions";
import { ClickMode } from "../../../../../../src/models/rooms/EventTileModel";
import {
    buildContextMenuState,
    copyLinkToThread,
    onListTileClick,
    onPermalinkClicked,
    openEventInRoom,
    type EventTileCommandContext,
    type EventTileCommandDeps,
} from "../../../../../../src/components/views/rooms/EventTile/EventTileCommands";
import { mkMessage, stubClient } from "../../../../../test-utils";

describe("EventTileCommands", () => {
    const ROOM_ID = "!roomId:example.org";
    let mxEvent: MatrixEvent;
    let deps: jest.Mocked<EventTileCommandDeps>;

    function makeContext(overrides: Partial<EventTileCommandContext> = {}): EventTileCommandContext {
        return {
            mxEvent,
            openedFromSearch: false,
            tileClickMode: ClickMode.None,
            ...overrides,
        };
    }

    beforeEach(() => {
        stubClient();
        const client = MatrixClientPeg.safeGet();
        const room = new Room(ROOM_ID, client, client.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
            timelineSupport: true,
        });

        mxEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Hello world!",
            event: true,
        });

        deps = {
            dispatch: jest.fn(),
            copyPlaintext: jest.fn().mockResolvedValue(undefined),
            trackInteraction: jest.fn(),
            allowOverridingNativeContextMenus: jest.fn().mockReturnValue(true),
        };
    });

    it("opens an event in room", () => {
        openEventInRoom(deps, makeContext());

        expect(deps.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: mxEvent.getId(),
            highlighted: true,
            room_id: mxEvent.getRoomId(),
            metricsTrigger: undefined,
        });
    });

    it("adds search metrics when opening from permalink in search", () => {
        const preventDefault = jest.fn();

        onPermalinkClicked(deps, makeContext({ openedFromSearch: true }), { preventDefault });

        expect(preventDefault).toHaveBeenCalled();
        expect(deps.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: mxEvent.getId(),
            highlighted: true,
            room_id: mxEvent.getRoomId(),
            metricsTrigger: "MessageSearch",
        });
    });

    it("copies the thread permalink when available", async () => {
        const permalinkCreator = {
            forEvent: jest.fn().mockReturnValue("https://example.org/#/room/$event"),
        } as any;

        await copyLinkToThread(deps, makeContext({ permalinkCreator }));

        expect(permalinkCreator.forEvent).toHaveBeenCalledWith(mxEvent.getId());
        expect(deps.copyPlaintext).toHaveBeenCalledWith("https://example.org/#/room/$event");
    });

    it("does nothing when copying a thread link without a permalink creator", async () => {
        await copyLinkToThread(deps, makeContext());

        expect(deps.copyPlaintext).not.toHaveBeenCalled();
    });

    it("builds context menu state for non-anchor targets", () => {
        const target = document.createElement("div");
        const preventDefault = jest.fn();
        const stopPropagation = jest.fn();

        const state = buildContextMenuState(deps, makeContext(), {
            clientX: 10,
            clientY: 20,
            target,
            preventDefault,
            stopPropagation,
        });

        expect(preventDefault).toHaveBeenCalled();
        expect(stopPropagation).toHaveBeenCalled();
        expect(state).toEqual({
            position: {
                left: 10,
                top: 20,
                bottom: 20,
            },
            link: undefined,
        });
    });

    it("suppresses the custom context menu for anchor targets when native menus are preserved", () => {
        deps.allowOverridingNativeContextMenus.mockReturnValue(false);
        const anchor = document.createElement("a");
        anchor.href = "https://example.org";

        const state = buildContextMenuState(deps, makeContext(), {
            clientX: 10,
            clientY: 20,
            target: anchor,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        });

        expect(state).toBeUndefined();
    });

    it("suppresses the custom context menu while editing", () => {
        const target = document.createElement("div");

        const state = buildContextMenuState(deps, makeContext({ editState: {} as any }), {
            clientX: 10,
            clientY: 20,
            target,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        });

        expect(state).toBeUndefined();
    });

    it("opens the room on notification list click", () => {
        onListTileClick(deps, makeContext({ tileClickMode: ClickMode.ViewRoom }), new Event("click"), 2);

        expect(deps.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: mxEvent.getId(),
            highlighted: true,
            room_id: mxEvent.getRoomId(),
            metricsTrigger: undefined,
        });
        expect(deps.trackInteraction).not.toHaveBeenCalled();
    });

    it("opens the thread and tracks interaction on thread list click", () => {
        const event = new Event("click");

        onListTileClick(deps, makeContext({ tileClickMode: ClickMode.ShowThread }), event, 3);

        expect(deps.dispatch).toHaveBeenCalledWith({
            action: Action.ShowThread,
            rootEvent: mxEvent,
            push: true,
        });
        expect(deps.trackInteraction).toHaveBeenCalledWith("WebThreadsPanelThreadItem", event, 3);
    });
});
