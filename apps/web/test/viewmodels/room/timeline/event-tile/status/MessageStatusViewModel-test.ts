/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventStatus } from "matrix-js-sdk/src/matrix";

import {
    MessageStatusMode,
    MessageStatusViewModel,
    type MessageStatusViewModelProps,
} from "../../../../../../src/viewmodels/room/timeline/event-tile/status/MessageStatusViewModel";

describe("MessageStatusViewModel", () => {
    const createVm = (props: Partial<MessageStatusViewModelProps> = {}): MessageStatusViewModel =>
        new MessageStatusViewModel({
            shouldShowSentReceipt: false,
            shouldShowSendingReceipt: false,
            showReadReceipts: false,
            ...props,
        });

    it.each([
        [undefined, MessageStatusMode.SentReceipt, "Your message was sent"],
        [EventStatus.SENT, MessageStatusMode.SentReceipt, "Your message was sent"],
        [EventStatus.NOT_SENT, MessageStatusMode.FailedReceipt, "Failed to send"],
        [EventStatus.ENCRYPTING, MessageStatusMode.EncryptingReceipt, "Encrypting your message\u2026"],
        [EventStatus.SENDING, MessageStatusMode.SendingReceipt, "Sending your message\u2026"],
    ])("derives special receipt mode for %s", (messageState, mode, label) => {
        const vm = createVm({
            messageState,
            shouldShowSentReceipt: true,
            showReadReceipts: true,
        });

        expect(vm.getSnapshot()).toEqual({ mode, label });
    });

    it("derives read receipts when no special receipt is active", () => {
        const vm = createVm({ showReadReceipts: true });

        expect(vm.getSnapshot()).toEqual({ mode: MessageStatusMode.ReadReceipts });
    });

    it("derives none when no status should render", () => {
        const vm = createVm();

        expect(vm.getSnapshot()).toEqual({ mode: MessageStatusMode.None });
    });

    it("updates the snapshot from new props", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setProps({
            messageState: EventStatus.NOT_SENT,
            shouldShowSentReceipt: false,
            shouldShowSendingReceipt: true,
            showReadReceipts: false,
        });

        expect(vm.getSnapshot()).toEqual({ mode: MessageStatusMode.FailedReceipt, label: "Failed to send" });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("removes stale labels when moving to a label-less mode", () => {
        const vm = createVm({ shouldShowSentReceipt: true });

        vm.setProps({
            shouldShowSentReceipt: false,
            shouldShowSendingReceipt: false,
            showReadReceipts: true,
        });

        expect(vm.getSnapshot()).toEqual({ mode: MessageStatusMode.ReadReceipts });
    });
});
