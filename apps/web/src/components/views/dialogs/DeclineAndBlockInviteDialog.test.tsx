/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { render } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, afterEach } from "vitest";

import SdkConfig from "../../../SdkConfig";
import { DeclineAndBlockInviteDialog } from "./DeclineAndBlockInviteDialog";

describe("ConfirmRejectInviteDialog", () => {
    const onFinished = vi.fn();

    const MY_ROOM_NAME = "foo";

    afterEach(() => {
        vi.resetAllMocks();
        SdkConfig.reset();
    });

    it("can close the dialog", async () => {
        const { getByTestId } = render(<DeclineAndBlockInviteDialog onFinished={onFinished} roomName={MY_ROOM_NAME} />);
        await userEvent.click(getByTestId("dialog-cancel-button"));
        expect(onFinished).toHaveBeenCalledWith(false, false, false);
    });

    it("can reject with options selected", async () => {
        const { container, getByLabelText, getByRole } = render(
            <DeclineAndBlockInviteDialog onFinished={onFinished} roomName={MY_ROOM_NAME} />,
        );
        await userEvent.click(getByRole("switch", { name: "Ignore user" }));
        await userEvent.click(getByRole("switch", { name: "Report room" }));
        await userEvent.type(getByLabelText("Reason"), "I want to report this room");
        expect(container).toMatchSnapshot();
        await userEvent.click(getByRole("button", { name: "Decline invite" }));
        expect(onFinished).toHaveBeenCalledWith(true, true, "I want to report this room");
    });
    it("can reject without a reason", async () => {
        const { getByRole } = render(<DeclineAndBlockInviteDialog onFinished={onFinished} roomName={MY_ROOM_NAME} />);
        await userEvent.click(getByRole("switch", { name: "Ignore user" }));
        await userEvent.click(getByRole("switch", { name: "Report room" }));
        await userEvent.click(getByRole("button", { name: "Decline invite" }));
        expect(onFinished).toHaveBeenCalledWith(true, true, "");
    });
});
