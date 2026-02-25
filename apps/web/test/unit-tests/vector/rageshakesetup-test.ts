/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "@fetch-mock/jest";

import type { Mocked } from "jest-mock";
import type { ConsoleLogger } from "../../../src/rageshake/rageshake";
import SdkConfig from "../../../src/SdkConfig";
import "../../../src/vector/rageshakesetup";
import { BugReportEndpointURLLocal } from "../../../src/IConfigOptions";

const RAGESHAKE_URL = "https://logs.example.org/logtome";

describe("mxSendRageshake", () => {
    let prevLogger: ConsoleLogger;
    beforeEach(() => {
        fetchMock.mockGlobal();
        SdkConfig.put({ bug_report_endpoint_url: RAGESHAKE_URL });
        fetchMock.postOnce(RAGESHAKE_URL, { status: 200, body: {} });

        const mockConsoleLogger = {
            flush: jest.fn(),
            consume: jest.fn(),
            warn: jest.fn(),
        } as unknown as Mocked<ConsoleLogger>;
        prevLogger = global.mx_rage_logger;
        mockConsoleLogger.flush.mockReturnValue("line 1\nline 2\n");
        global.mx_rage_logger = mockConsoleLogger;
    });

    afterEach(() => {
        global.mx_rage_logger = prevLogger;
        jest.restoreAllMocks();
        fetchMock.unmockGlobal();
        SdkConfig.reset();
    });

    it("Does not send a rageshake if the URL is not configured", async () => {
        SdkConfig.put({ bug_report_endpoint_url: undefined });
        await window.mxSendRageshake("test");
        expect(fetchMock).not.toHaveFetched();
    });

    it.each(["", "  ", undefined, null])("Does not send a rageshake if text is '%s'", async (text) => {
        await window.mxSendRageshake(text as string);
        expect(fetchMock).not.toHaveFetched();
    });

    it("Sends a rageshake via URL", async () => {
        await window.mxSendRageshake("Hello world");
        expect(fetchMock).toHaveFetched(RAGESHAKE_URL);
    });

    it("Provides a rageshake locally", async () => {
        SdkConfig.put({ bug_report_endpoint_url: BugReportEndpointURLLocal });
        const urlSpy = jest.spyOn(URL, "createObjectURL");
        await window.mxSendRageshake("Hello world");
        expect(fetchMock).not.toHaveFetched(RAGESHAKE_URL);
        expect(urlSpy).toHaveBeenCalledTimes(1);
    });
});
