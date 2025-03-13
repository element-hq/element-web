/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";

import { getVectorConfig } from "../../../src/vector/getconfig";

fetchMock.config.overwriteRoutes = true;

describe("getVectorConfig()", () => {
    const elementDomain = "app.element.io";
    const now = 1234567890;
    const specificConfig = {
        brand: "specific",
    };
    const generalConfig = {
        brand: "general",
    };

    beforeEach(() => {
        Object.defineProperty(window, "location", {
            value: { href: `https://${elementDomain}`, hostname: elementDomain },
            writable: true,
        });

        // stable value for cachebuster
        jest.spyOn(Date, "now").mockReturnValue(now);
        jest.clearAllMocks();
        fetchMock.mockClear();
    });

    afterAll(() => {
        jest.spyOn(Date, "now").mockRestore();
    });

    it("requests specific config for document domain", async () => {
        fetchMock.getOnce("express:/config.app.element.io.json", specificConfig);
        fetchMock.getOnce("express:/config.json", generalConfig);

        await expect(getVectorConfig()).resolves.toEqual(specificConfig);
    });

    it("adds trailing slash to relativeLocation when not an empty string", async () => {
        fetchMock.getOnce("express:../config.app.element.io.json", specificConfig);
        fetchMock.getOnce("express:../config.json", generalConfig);

        await expect(getVectorConfig("..")).resolves.toEqual(specificConfig);
    });

    it("returns general config when specific config succeeds but is empty", async () => {
        fetchMock.getOnce("express:/config.app.element.io.json", {});
        fetchMock.getOnce("express:/config.json", generalConfig);

        await expect(getVectorConfig()).resolves.toEqual(generalConfig);
    });

    it("returns general config when specific config 404s", async () => {
        fetchMock.getOnce("express:/config.app.element.io.json", { status: 404 });
        fetchMock.getOnce("express:/config.json", generalConfig);

        await expect(getVectorConfig()).resolves.toEqual(generalConfig);
    });

    it("returns general config when specific config is fetched from a file and is empty", async () => {
        fetchMock.getOnce("express:/config.app.element.io.json", 0);
        fetchMock.getOnce("express:/config.json", generalConfig);

        await expect(getVectorConfig()).resolves.toEqual(generalConfig);
    });

    it("returns general config when specific config returns a non-200 status", async () => {
        fetchMock.getOnce("express:/config.app.element.io.json", { status: 401 });
        fetchMock.getOnce("express:/config.json", generalConfig);

        await expect(getVectorConfig()).resolves.toEqual(generalConfig);
    });

    it("returns general config when specific config returns an error", async () => {
        fetchMock.getOnce("express:/config.app.element.io.json", { throws: "err1" });
        fetchMock.getOnce("express:/config.json", generalConfig);

        await expect(getVectorConfig()).resolves.toEqual(generalConfig);
    });

    it("rejects with an error when general config rejects", async () => {
        fetchMock.getOnce("express:/config.app.element.io.json", { throws: "err-specific" });
        fetchMock.getOnce("express:/config.json", { throws: "err-general" });

        await expect(getVectorConfig()).rejects.toBe("err-general");
    });

    it("rejects with an error when config is invalid JSON", async () => {
        fetchMock.getOnce("express:/config.app.element.io.json", { throws: "err-specific" });
        fetchMock.getOnce("express:/config.json", '{"invalid": "json",}');

        // We can't assert it'll be a SyntaxError as node-fetch behaves differently
        // https://github.com/wheresrhys/fetch-mock/issues/270
        await expect(getVectorConfig()).rejects.toThrow("in JSON at position 19");
    });
});
