/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent } from "react";
import { mocked } from "jest-mock";
import { EventType, type MatrixClient, MatrixEventEvent, MsgType } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { ReplyTileViewModel } from "../../../src/viewmodels/room/timeline/event-tile/ReplyTileViewModel";
import { Action } from "../../../src/dispatcher/actions";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { type RoomPermalinkCreator } from "../../../src/utils/permalinks/Permalinks";
import { mkEvent, stubClient } from "../../test-utils";

jest.mock("../../../src/dispatcher/dispatcher", () => ({
    __esModule: true,
    default: {
        dispatch: jest.fn(),
        register: jest.fn(() => "reply-tile-test"),
        unregister: jest.fn(),
    },
}));

jest.mock("../../../src/languageHandler", () => ({
    _td: (key: string) => key,
    _t: (key: string) => {
        if (key === "timeline|error_no_renderer") return "Unable to render message";

        return key;
    },
}));

describe("ReplyTileViewModel", () => {
    let client: MatrixClient;

    const createEvent = ({
        id = "$event",
        type = EventType.RoomMessage,
        body = "Hello",
        msgtype = MsgType.Text,
    }: {
        id?: string;
        type?: string;
        body?: string;
        msgtype?: MsgType;
    } = {}) =>
        mkEvent({
            event: true,
            type,
            user: "@alice:server",
            room: "!room:server",
            id,
            content: {
                body,
                msgtype,
            },
        });

    beforeEach(() => {
        client = stubClient();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("derives the initial snapshot from the event", () => {
        const vm = new ReplyTileViewModel({
            client,
            mxEvent: createEvent({
                msgtype: MsgType.Emote,
            }),
        });

        expect(vm.getSnapshot()).toMatchObject({
            permalink: "#",
            isInline: true,
            isInfoMessage: false,
            showSender: true,
            isSeeingThroughMessageHiddenForModeration: false,
        });
    });

    it("uses the permalink creator when one is supplied", () => {
        const permalinkCreator = {
            forEvent: jest.fn().mockReturnValue("https://matrix.to/#/!room:server/$event"),
        } as unknown as RoomPermalinkCreator;
        const vm = new ReplyTileViewModel({
            client,
            mxEvent: createEvent(),
            permalinkCreator,
        });

        expect(vm.getSnapshot().permalink).toBe("https://matrix.to/#/!room:server/$event");

        const listener = jest.fn();
        vm.subscribe(listener);
        vm.setPermalinkCreator(permalinkCreator);

        expect(listener).not.toHaveBeenCalled();
    });

    it("dispatches view_room when the reply tile is opened", () => {
        const vm = new ReplyTileViewModel({
            client,
            mxEvent: createEvent(),
        });

        vm.onClick({ shiftKey: false } as MouseEvent<HTMLAnchorElement>);

        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            event_id: "$event",
            highlighted: true,
            room_id: "!room:server",
            metricsTrigger: undefined,
        });
    });

    it("toggles the expanded quote instead of dispatching when shift-clicked", () => {
        const toggleExpandedQuote = jest.fn();
        const vm = new ReplyTileViewModel({
            client,
            mxEvent: createEvent(),
            toggleExpandedQuote,
        });

        vm.onClick({ shiftKey: true } as MouseEvent<HTMLAnchorElement>);

        expect(toggleExpandedQuote).toHaveBeenCalledTimes(1);
        expect(defaultDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it("emits a fresh snapshot when mutable event content changes", () => {
        const mxEvent = createEvent();
        const vm = new ReplyTileViewModel({
            client,
            mxEvent,
        });
        const listener = jest.fn();
        const previousSnapshot = vm.getSnapshot();

        vm.subscribe(listener);
        mxEvent.emit(MatrixEventEvent.Replaced, mxEvent);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot()).not.toBe(previousSnapshot);
    });

    it("removes Matrix event listeners when disposed", () => {
        const mxEvent = createEvent();
        const vm = new ReplyTileViewModel({
            client,
            mxEvent,
        });
        const listener = jest.fn();

        vm.subscribe(listener);
        vm.dispose();
        mxEvent.emit(MatrixEventEvent.Replaced, mxEvent);

        expect(listener).not.toHaveBeenCalled();
    });

    it("returns a no-renderer fallback when the event is unsupported", () => {
        jest.spyOn(logger, "warn").mockImplementation();

        const vm = new ReplyTileViewModel({
            client,
            mxEvent: createEvent({
                type: "example.unsupported",
            }),
        });

        expect(vm.getSnapshot().noRendererMessage).toBe("Unable to render message");
        expect(mocked(logger.warn)).toHaveBeenCalledWith(
            "Event type not supported: type:example.unsupported isState:false",
        );
    });
});
