/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { MsgType, type RoomMember } from "matrix-js-sdk/src/matrix";

import { SenderProfileViewModel } from "../../../src/viewmodels/message-body/SenderProfileViewModel";
import { mkEvent } from "../../test-utils";

describe("SenderProfileViewModel", () => {
    const createMember = (overrides: Partial<RoomMember> = {}): RoomMember =>
        ({
            userId: "@alice:example.org",
            roomId: "!room:example.org",
            rawDisplayName: "Alice",
            disambiguate: true,
            ...overrides,
        }) as RoomMember;

    const createMessageEvent = (msgtype: MsgType = MsgType.Text) =>
        mkEvent({
            event: true,
            type: "m.room.message",
            room: "!room:example.org",
            user: "@alice:example.org",
            content: {
                msgtype,
                body: "Hello",
            },
        });

    it("should compute a visible snapshot for non-emote messages", () => {
        const vm = new SenderProfileViewModel({
            mxEvent: createMessageEvent(),
            member: createMember(),
            withTooltip: true,
        });

        expect(vm.getSnapshot()).toEqual({
            isVisible: true,
            displayName: "Alice",
            displayIdentifier: "@alice:example.org",
            title: "Alice (@alice:example.org)",
            colorClass: "mx_Username_color3",
            className: "mx_DisambiguatedProfile",
            emphasizeDisplayName: true,
        });
    });

    it("should hide sender profile for emote messages", () => {
        const vm = new SenderProfileViewModel({
            mxEvent: createMessageEvent(MsgType.Emote),
            member: createMember(),
        });

        expect(vm.getSnapshot().isVisible).toBe(false);
    });

    it("should fall back to sender when member is unavailable", () => {
        const vm = new SenderProfileViewModel({
            mxEvent: createMessageEvent(),
            member: null,
            withTooltip: true,
        });

        expect(vm.getSnapshot()).toMatchObject({
            isVisible: true,
            displayName: "@alice:example.org",
            displayIdentifier: undefined,
            title: undefined,
            colorClass: undefined,
        });
    });

    it("should omit displayIdentifier when member does not require disambiguation", () => {
        const vm = new SenderProfileViewModel({
            mxEvent: createMessageEvent(),
            member: createMember({ disambiguate: false }),
        });

        expect(vm.getSnapshot().displayIdentifier).toBeUndefined();
    });

    it("should update snapshot when setProps is called", () => {
        const vm = new SenderProfileViewModel({
            mxEvent: createMessageEvent(MsgType.Emote),
            member: null,
            withTooltip: false,
        });
        const subscriber = jest.fn();
        vm.subscribe(subscriber);

        vm.setProps({
            mxEvent: createMessageEvent(MsgType.Text),
            member: createMember({ rawDisplayName: "Alice Updated" }),
            withTooltip: true,
        });

        expect(subscriber).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot()).toMatchObject({
            isVisible: true,
            displayName: "Alice Updated",
            title: "Alice Updated (@alice:example.org)",
        });
    });

    it("should expose onClick action only when callback is provided", () => {
        const onClick = jest.fn();
        const withHandler = new SenderProfileViewModel({
            mxEvent: createMessageEvent(),
            member: createMember(),
            onClick,
        });
        const withoutHandler = new SenderProfileViewModel({
            mxEvent: createMessageEvent(),
            member: createMember(),
        });

        withHandler.onClick?.();

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(withoutHandler.onClick).toBeUndefined();
    });
});
