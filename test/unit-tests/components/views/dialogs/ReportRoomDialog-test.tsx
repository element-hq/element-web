/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { ReportRoomDialog } from "../../../../../src/components/views/dialogs/ReportRoomDialog";
import SdkConfig from "../../../../../src/SdkConfig";
import { stubClient } from "../../../../test-utils";

const ROOM_ID = "!foo:bar";
const REASON = "This room is bad!";

describe("ReportRoomDialog", () => {
    const onFinished: jest.Mock<any, any> = jest.fn();
    const reportRoom: jest.Mock<any, any> = jest.fn();
    beforeEach(() => {
        jest.resetAllMocks();
        const client = stubClient();
        client.reportRoom = reportRoom;

        SdkConfig.put({
            report_event: {
                admin_message_md: `
# You should know

This doesn't actually go **anywhere**.`,
            },
        });
    });

    afterEach(() => {
        SdkConfig.reset();
    });

    it("can close the dialog", async () => {
        const { getByTestId } = render(<ReportRoomDialog roomId={ROOM_ID} onFinished={onFinished} />);
        await userEvent.click(getByTestId("dialog-cancel-button"));
        expect(onFinished).toHaveBeenCalledWith(false);
    });

    it("displays admin message", async () => {
        const { container } = render(<ReportRoomDialog roomId={ROOM_ID} onFinished={onFinished} />);
        expect(container).toMatchSnapshot();
    });

    it("can submit a report without leaving the room", async () => {
        const { getByLabelText, getByRole } = render(<ReportRoomDialog roomId={ROOM_ID} onFinished={onFinished} />);

        await userEvent.type(getByLabelText("Describe the reason"), REASON);
        await userEvent.click(getByRole("button", { name: "Send report" }));

        expect(reportRoom).toHaveBeenCalledWith(ROOM_ID, REASON);
        expect(onFinished).toHaveBeenCalledWith(false);
    });

    it("can submit a report and leave the room", async () => {
        const { getByLabelText, getByRole } = render(<ReportRoomDialog roomId={ROOM_ID} onFinished={onFinished} />);

        await userEvent.type(getByLabelText("Describe the reason"), REASON);
        await userEvent.click(getByRole("switch", { name: "Leave room" }));
        await userEvent.click(getByRole("button", { name: "Send report" }));

        expect(reportRoom).toHaveBeenCalledWith(ROOM_ID, REASON);
        expect(onFinished).toHaveBeenCalledWith(true);
    });
});
