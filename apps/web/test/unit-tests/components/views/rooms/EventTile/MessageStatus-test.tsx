/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { EventStatus } from "matrix-js-sdk/src/matrix";
import { render, screen } from "jest-matrix-react";

import { MessageStatus } from "../../../../../../src/components/views/rooms/EventTile/MessageStatus";
import type { ReadReceiptProps } from "../../../../../../src/models/rooms/EventTileTypes";

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
    it("renders the sent receipt as a status region", () => {
        render(
            <MessageStatus
                messageState={EventStatus.SENT}
                shouldShowSentReceipt={true}
                shouldShowSendingReceipt={false}
                showReadReceipts={false}
                suppressReadReceiptAnimation={false}
            />,
        );

        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(screen.getByLabelText("Your message was sent")).toBeInTheDocument();
    });

    it("treats an undefined message state as sent", () => {
        render(
            <MessageStatus
                messageState={undefined}
                shouldShowSentReceipt={true}
                shouldShowSendingReceipt={false}
                showReadReceipts={false}
                suppressReadReceiptAnimation={false}
            />,
        );

        expect(screen.getByLabelText("Your message was sent")).toBeInTheDocument();
    });

    it("renders the failed send state", () => {
        render(
            <MessageStatus
                messageState={EventStatus.NOT_SENT}
                shouldShowSentReceipt={false}
                shouldShowSendingReceipt={true}
                showReadReceipts={false}
                suppressReadReceiptAnimation={false}
            />,
        );

        expect(screen.getByLabelText("Failed to send")).toBeInTheDocument();
    });

    it("prefers the special receipt over read receipts", () => {
        render(
            <MessageStatus
                messageState={EventStatus.SENT}
                shouldShowSentReceipt={true}
                shouldShowSendingReceipt={false}
                showReadReceipts={true}
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
                messageState={EventStatus.SENT}
                shouldShowSentReceipt={false}
                shouldShowSendingReceipt={false}
                showReadReceipts={true}
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
});
