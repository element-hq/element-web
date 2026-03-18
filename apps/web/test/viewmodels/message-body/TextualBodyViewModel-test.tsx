/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent, type MouseEventHandler } from "react";
import { TextualBodyViewBodyWrapperKind, TextualBodyViewKind } from "@element-hq/web-shared-components";
import { MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { TextualBodyViewModel } from "../../../src/viewmodels/message-body/TextualBodyViewModel";
import { mkEvent } from "../../test-utils";

const mkMessageEvent = (content: Record<string, unknown>): MatrixEvent =>
    mkEvent({
        type: "m.room.message",
        room: "!room:example.org",
        user: "@alice:example.org",
        content: {
            body: "Hello world",
            msgtype: MsgType.Text,
            ...content,
        },
        event: true,
    });

describe("TextualBodyViewModel", () => {
    const createVm = (
        overrides: Partial<ConstructorParameters<typeof TextualBodyViewModel>[0]> = {},
    ): TextualBodyViewModel =>
        new TextualBodyViewModel({
            mxEvent: mkMessageEvent({}),
            ...overrides,
        });

    it("computes the initial snapshot from props", () => {
        const vm = createVm({
            id: "event-id",
            highlightLink: "#/room/!room:example.org/$event",
            replacingEventId: "$replacement",
        });

        expect(vm.getSnapshot()).toMatchObject({
            id: "event-id",
            kind: TextualBodyViewKind.TEXT,
            bodyWrapper: TextualBodyViewBodyWrapperKind.LINK,
            bodyLinkHref: "#/room/!room:example.org/$event",
            showEditedMarker: true,
            editedMarkerText: "(edited)",
        });
    });

    it("updates only the body wrapper fields when the highlight link changes", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setHighlightLink("#/room/!room:example.org/$event");

        expect(vm.getSnapshot()).toMatchObject({
            bodyWrapper: TextualBodyViewBodyWrapperKind.LINK,
            bodyLinkHref: "#/room/!room:example.org/$event",
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("updates the edited marker fields when replacingEventId changes", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setReplacingEventId("$replacement");

        expect(vm.getSnapshot()).toMatchObject({
            showEditedMarker: true,
            editedMarkerText: "(edited)",
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("updates the pending moderation fields when visibility changes", () => {
        const event = mkMessageEvent({});
        jest.spyOn(event, "messageVisibility").mockReturnValue({
            visible: false,
            reason: "spam",
        } as ReturnType<MatrixEvent["messageVisibility"]>);

        const vm = createVm({ mxEvent: event });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setIsSeeingThroughMessageHiddenForModeration(true);

        expect(vm.getSnapshot()).toMatchObject({
            showPendingModerationMarker: true,
            pendingModerationText: expect.stringContaining("spam"),
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("updates event-dependent snapshot fields when the event changes", () => {
        const vm = createVm();
        const emoteEvent = mkMessageEvent({
            body: "waves",
            msgtype: MsgType.Emote,
            data: { "org.matrix.neb.starter_link": "https://starter.example.org" },
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setEvent(emoteEvent);

        expect(vm.getSnapshot()).toMatchObject({
            kind: TextualBodyViewKind.EMOTE,
            bodyWrapper: TextualBodyViewBodyWrapperKind.ACTION,
            emoteSenderName: "@alice:example.org",
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not emit for guarded setters when values are unchanged", () => {
        const event = mkMessageEvent({});
        const onRootClick = jest.fn() as MouseEventHandler<HTMLDivElement>;
        const onBodyActionClick = jest.fn() as MouseEventHandler<HTMLDivElement>;
        const onEditedMarkerClick = jest.fn() as MouseEventHandler<HTMLButtonElement>;
        const onEmoteSenderClick = jest.fn() as MouseEventHandler<HTMLButtonElement>;
        const vm = createVm({
            mxEvent: event,
            onRootClick,
            onBodyActionClick,
            onEditedMarkerClick,
            onEmoteSenderClick,
        });
        const previousSnapshot = vm.getSnapshot();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setId(undefined);
        vm.setEvent(event);
        vm.setHighlightLink(undefined);
        vm.setReplacingEventId(undefined);
        vm.setIsSeeingThroughMessageHiddenForModeration(undefined);
        vm.setHandlers({
            onRootClick,
            onBodyActionClick,
            onEditedMarkerClick,
            onEmoteSenderClick,
        });

        expect(listener).not.toHaveBeenCalled();
        expect(vm.getSnapshot()).toEqual(previousSnapshot);
    });

    it("forwards handler actions", () => {
        const vm = createVm();
        const onRootClick = jest.fn();
        const onBodyActionClick = jest.fn();
        const onEditedMarkerClick = jest.fn();
        const onEmoteSenderClick = jest.fn();

        vm.setHandlers({
            onRootClick: onRootClick as MouseEventHandler<HTMLDivElement>,
            onBodyActionClick: onBodyActionClick as MouseEventHandler<HTMLDivElement>,
            onEditedMarkerClick: onEditedMarkerClick as MouseEventHandler<HTMLButtonElement>,
            onEmoteSenderClick: onEmoteSenderClick as MouseEventHandler<HTMLButtonElement>,
        });

        vm.onRootClick({} as MouseEvent<HTMLDivElement>);
        vm.onBodyActionClick({} as MouseEvent<HTMLDivElement>);
        vm.onEditedMarkerClick({} as MouseEvent<HTMLButtonElement>);
        vm.onEmoteSenderClick({} as MouseEvent<HTMLButtonElement>);

        expect(onRootClick).toHaveBeenCalledTimes(1);
        expect(onBodyActionClick).toHaveBeenCalledTimes(1);
        expect(onEditedMarkerClick).toHaveBeenCalledTimes(1);
        expect(onEmoteSenderClick).toHaveBeenCalledTimes(1);
    });
});
