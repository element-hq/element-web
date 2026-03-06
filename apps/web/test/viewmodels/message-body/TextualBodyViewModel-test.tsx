/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEvent } from "react";
import { MsgType } from "matrix-js-sdk/src/matrix";

import { TextualBodyViewModel } from "../../../src/viewmodels/message-body/TextualBodyViewModel";

describe("TextualBodyViewModel", () => {
    const createVm = (
        overrides?: Partial<ConstructorParameters<typeof TextualBodyViewModel>[0]>,
    ): TextualBodyViewModel =>
        new TextualBodyViewModel({
            id: "event-id",
            msgType: MsgType.Text,
            body: <span>hello world</span>,
            widgets: undefined,
            emoteSender: undefined,
            replacingEventId: undefined,
            replacingEventDate: undefined,
            isSeeingThroughMessageHiddenForModeration: false,
            pendingModerationReason: undefined,
            ...overrides,
        });

    it("computes the initial snapshot", () => {
        const vm = createVm({
            msgType: MsgType.Emote,
            emoteSender: "Alice",
            replacingEventId: "$edit",
            replacingEventDate: new Date("2026-03-06T10:20:00.000Z"),
        });

        expect(vm.getSnapshot()).toMatchObject({
            id: "event-id",
            kind: "emote",
            emoteSender: "Alice",
            editedMarkerText: "(edited)",
        });
    });

    it("maps media message types to the caption kind", () => {
        const vm = createVm({ msgType: MsgType.Image });

        expect(vm.getSnapshot().kind).toBe("caption");
    });

    it("updates body and kind when message content changes", () => {
        const vm = createVm();
        const nextBody = <span>notice</span>;

        vm.setMessageContent({
            msgType: MsgType.Notice,
            body: nextBody,
            emoteSender: undefined,
        });

        expect(vm.getSnapshot()).toMatchObject({
            kind: "notice",
            body: nextBody,
        });
    });

    it("updates moderation text when the message is visible only to moderators", () => {
        const vm = createVm();

        vm.setPendingModeration(true, "policy violation");

        expect(vm.getSnapshot().pendingModerationText).toContain("policy violation");
    });

    it("forwards action handlers", () => {
        const vm = createVm();
        const onBodyClick = jest.fn();
        const onEditedMarkerClick = jest.fn();
        const onEmoteSenderClick = jest.fn();

        vm.setHandlers({
            onBodyClick,
            onEditedMarkerClick,
            onEmoteSenderClick,
        });

        const divClickEvent = {
            currentTarget: document.createElement("div"),
        } as unknown as MouseEvent<HTMLDivElement>;
        const buttonClickEvent = {
            currentTarget: document.createElement("button"),
        } as unknown as MouseEvent<HTMLButtonElement>;

        vm.onBodyClick?.(divClickEvent);
        vm.onEditedMarkerClick?.(buttonClickEvent);
        vm.onEmoteSenderClick?.(buttonClickEvent);

        expect(onBodyClick).toHaveBeenCalledWith(divClickEvent);
        expect(onEditedMarkerClick).toHaveBeenCalledWith(buttonClickEvent);
        expect(onEmoteSenderClick).toHaveBeenCalledWith(buttonClickEvent);
    });

    it("skips emitting when granular setters receive unchanged values", () => {
        const body = <span>stable body</span>;
        const vm = createVm({
            body,
            widgets: <div>widget</div>,
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setId("event-id");
        vm.setMessageContent({
            msgType: MsgType.Text,
            body,
            emoteSender: undefined,
        });
        vm.setEditedState(undefined, undefined);
        vm.setPendingModeration(false, undefined);
        vm.setWidgets(vm.getSnapshot().widgets);

        expect(listener).not.toHaveBeenCalled();
    });
});
