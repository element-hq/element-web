import { Mocked } from "jest-mock";
import { ConsoleLogger } from "../../../src/rageshake/rageshake";
import SdkConfig from "../../../src/SdkConfig";
import "../../../src/vector/rageshakesetup";
import fetchMock from "@fetch-mock/jest";

const RAGESHAKE_URL = "https://logs.example.org/logtome";

const prevLogger = global.mx_rage_logger;

describe("mxSendRageshake", () => {
    beforeEach(() => {
        fetchMock.mockGlobal();
        SdkConfig.put({ bug_report_endpoint_url: RAGESHAKE_URL });
        fetchMock.postOnce(RAGESHAKE_URL, { status: 200, body: {} });

        const mockConsoleLogger = {
            flush: jest.fn(),
            consume: jest.fn(),
            warn: jest.fn(),
        } as unknown as Mocked<ConsoleLogger>;
        mockConsoleLogger.flush.mockReturnValue("line 1\nline 2\n");
        global.mx_rage_logger = mockConsoleLogger;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fetchMock.unmockGlobal();
        SdkConfig.reset();
        global.mx_rage_logger = prevLogger;
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
        SdkConfig.put({ bug_report_endpoint_url: "local" });
        const urlSpy = jest.spyOn(URL, "createObjectURL");
        await window.mxSendRageshake("Hello world");
        expect(fetchMock).not.toHaveFetched(RAGESHAKE_URL);
        expect(urlSpy).toHaveBeenCalledTimes(1);
    });
});
