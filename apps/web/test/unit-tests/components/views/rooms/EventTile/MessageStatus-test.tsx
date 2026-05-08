/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import { MessageStatus } from "../../../../../../src/components/views/rooms/EventTile/MessageStatus";
import type { ReadReceiptProps } from "../../../../../../src/components/views/rooms/EventTile/types";
import {
    MessageStatusMode,
    MessageStatusViewModel,
    type MessageStatusViewModelProps,
} from "../../../../../../src/viewmodels/room/timeline/event-tile/status/MessageStatusViewModel";

jest.mock("../../../../../../src/components/views/rooms/ReadReceiptGroup", () => ({
    ReadReceiptGroup: ({
        readReceipts,
        suppressAnimation,
        isTwelveHour,
    }: {
        readReceipts: ReadReceiptProps[];
        suppressAnimation: boolean;
        isTwelveHour?: boolean;
    }) => (
        <div data-testid="read-receipt-group">
            receipts:{readReceipts.length}:suppress:{String(suppressAnimation)}:twelve:{String(isTwelveHour)}
        </div>
    ),
}));

describe("MessageStatus", () => {
    const createVm = (props: Partial<MessageStatusViewModelProps>): MessageStatusViewModel =>
        new MessageStatusViewModel({
            shouldShowSentReceipt: false,
            shouldShowSendingReceipt: false,
            showReadReceipts: false,
            ...props,
        });

    const createModeVm = (mode: MessageStatusMode, label?: string): MessageStatusViewModel => {
        const vm = createVm({});
        jest.spyOn(vm, "getSnapshot").mockReturnValue({ mode, label });
        return vm;
    };

    it("renders the sent receipt as a status region", () => {
        render(
            <MessageStatus
                vm={createModeVm(MessageStatusMode.SentReceipt, "Your message was sent")}
                suppressReadReceiptAnimation={false}
            />,
        );

        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(screen.getByLabelText("Your message was sent")).toBeInTheDocument();
    });

    it("renders the sending state", () => {
        render(
            <MessageStatus
                vm={createModeVm(MessageStatusMode.SendingReceipt, "Sending your message\u2026")}
                suppressReadReceiptAnimation={false}
            />,
        );

        expect(screen.getByLabelText("Sending your message\u2026")).toBeInTheDocument();
    });

    it("renders the failed send state", () => {
        render(
            <MessageStatus
                vm={createModeVm(MessageStatusMode.FailedReceipt, "Failed to send")}
                suppressReadReceiptAnimation={false}
            />,
        );

        expect(screen.getByLabelText("Failed to send")).toBeInTheDocument();
    });

    it("prefers the special receipt over read receipts", () => {
        render(
            <MessageStatus
                vm={createModeVm(MessageStatusMode.SentReceipt, "Your message was sent")}
                readReceipts={[{ userId: "@alice:example.org", ts: 1, roomMember: null }]}
                suppressReadReceiptAnimation={false}
            />,
        );

        expect(screen.getByLabelText("Your message was sent")).toBeInTheDocument();
        expect(screen.queryByTestId("read-receipt-group")).toBeNull();
    });

    it("renders read receipts when no special receipt is shown", () => {
        render(
            <MessageStatus
                vm={createModeVm(MessageStatusMode.ReadReceipts)}
                readReceipts={[
                    { userId: "@alice:example.org", ts: 1, roomMember: null },
                    { userId: "@bob:example.org", ts: 2, roomMember: null },
                ]}
                suppressReadReceiptAnimation={true}
                isTwelveHour={true}
            />,
        );

        expect(screen.getByTestId("read-receipt-group")).toHaveTextContent("receipts:2:suppress:true:twelve:true");
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("renders nothing for none mode", () => {
        const { container } = render(
            <MessageStatus vm={createModeVm(MessageStatusMode.None)} suppressReadReceiptAnimation={false} />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
