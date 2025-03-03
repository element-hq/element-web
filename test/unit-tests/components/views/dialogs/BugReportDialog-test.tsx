/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render, waitFor, type RenderResult } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import React from "react";
import fetchMock from "fetch-mock-jest";
import { type Mocked } from "jest-mock";

import BugReportDialog, {
    type BugReportDialogProps,
} from "../../../../../src/components/views/dialogs/BugReportDialog";
import SdkConfig from "../../../../../src/SdkConfig";
import { type ConsoleLogger } from "../../../../../src/rageshake/rageshake";

const BUG_REPORT_URL = "https://example.org/submit";

describe("BugReportDialog", () => {
    const onFinished: jest.Mock<any, any> = jest.fn();

    function renderComponent(props: Partial<BugReportDialogProps> = {}): RenderResult {
        return render(<BugReportDialog onFinished={onFinished} />);
    }

    beforeEach(() => {
        jest.resetAllMocks();
        SdkConfig.put({
            bug_report_endpoint_url: BUG_REPORT_URL,
        });

        const mockConsoleLogger = {
            flush: jest.fn(),
            consume: jest.fn(),
            warn: jest.fn(),
        } as unknown as Mocked<ConsoleLogger>;

        // @ts-ignore - mock the console logger
        global.mx_rage_logger = mockConsoleLogger;

        // @ts-ignore
        mockConsoleLogger.flush.mockReturnValue([
            {
                id: "instance-0",
                line: "line 1",
            },
            {
                id: "instance-1",
                line: "line 2",
            },
        ]);
    });

    afterEach(() => {
        SdkConfig.reset();
        fetchMock.restore();
    });

    it("can close the bug reporter", async () => {
        const { getByTestId } = renderComponent();
        await userEvent.click(getByTestId("dialog-cancel-button"));
        expect(onFinished).toHaveBeenCalledWith(false);
    });

    it("can submit a bug report", async () => {
        const { getByLabelText, getByText } = renderComponent();
        fetchMock.postOnce(BUG_REPORT_URL, { report_url: "https://exmaple.org/report/url" });
        await userEvent.type(getByLabelText("GitHub issue"), "https://example.org/some/issue");
        await userEvent.type(getByLabelText("Notes"), "Additional text");
        await userEvent.click(getByText("Send logs"));
        await waitFor(() => expect(getByText("Thank you!")).toBeInTheDocument());
        expect(onFinished).toHaveBeenCalledWith(false);
        expect(fetchMock).toHaveFetched(BUG_REPORT_URL);
    });

    it.each([
        {
            errcode: undefined,
            text: "The rageshake server encountered an unknown error and could not handle the report.",
        },
        {
            errcode: "CUSTOM_ERROR_TYPE",
            text: "The rageshake server encountered an unknown error and could not handle the report.",
        },
        {
            errcode: "DISALLOWED_APP",
            text: "Your bug report was rejected. The rageshake server does not support this application.",
        },
        {
            errcode: "REJECTED_BAD_VERSION",
            text: "Your bug report was rejected as the version you are running is too old.",
        },
        {
            errcode: "REJECTED_UNEXPECTED_RECOVERY_KEY",
            text: "Your bug report was rejected for safety reasons, as it contained a recovery key.",
        },
        {
            errcode: "REJECTED_CUSTOM_REASON",
            text: "Your bug report was rejected. The rageshake server rejected the contents of the report due to a policy.",
        },
    ])("handles bug report upload errors ($errcode)", async ({ errcode, text }) => {
        const { getByLabelText, getByText } = renderComponent();
        fetchMock.postOnce(BUG_REPORT_URL, { status: 400, body: errcode ? { errcode: errcode, error: "blah" } : "" });
        await userEvent.type(getByLabelText("GitHub issue"), "https://example.org/some/issue");
        await userEvent.type(getByLabelText("Notes"), "Additional text");
        await userEvent.click(getByText("Send logs"));
        expect(onFinished).not.toHaveBeenCalled();
        expect(fetchMock).toHaveFetched(BUG_REPORT_URL);
        await waitFor(() => getByText(text));
    });

    it("should show a policy link when provided", async () => {
        const { getByLabelText, getByText } = renderComponent();
        fetchMock.postOnce(BUG_REPORT_URL, {
            status: 404,
            body: { errcode: "REJECTED_CUSTOM_REASON", error: "blah", policy_url: "https://example.org/policyurl" },
        });
        await userEvent.type(getByLabelText("GitHub issue"), "https://example.org/some/issue");
        await userEvent.type(getByLabelText("Notes"), "Additional text");
        await userEvent.click(getByText("Send logs"));
        expect(onFinished).not.toHaveBeenCalled();
        expect(fetchMock).toHaveFetched(BUG_REPORT_URL);
        await waitFor(() => {
            const learnMoreLink = getByText("Learn more");
            expect(learnMoreLink).toBeInTheDocument();
            expect(learnMoreLink.getAttribute("href")).toEqual("https://example.org/policyurl");
        });
    });
});
