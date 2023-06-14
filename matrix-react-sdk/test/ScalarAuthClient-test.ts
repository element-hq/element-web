/*
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { mocked } from "jest-mock";
import fetchMock from "fetch-mock-jest";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import ScalarAuthClient from "../src/ScalarAuthClient";
import { stubClient } from "./test-utils";
import SdkConfig from "../src/SdkConfig";
import { WidgetType } from "../src/widgets/WidgetType";

describe("ScalarAuthClient", function () {
    const apiUrl = "https://test.com/api";
    const uiUrl = "https:/test.com/app";
    const tokenObject = {
        access_token: "token",
        token_type: "Bearer",
        matrix_server_name: "localhost",
        expires_in: 999,
    };

    let client: MatrixClient;
    beforeEach(function () {
        jest.clearAllMocks();
        client = stubClient();
    });

    it("should request a new token if the old one fails", async function () {
        const sac = new ScalarAuthClient(apiUrl + 0, uiUrl);

        fetchMock.get("https://test.com/api0/account?scalar_token=brokentoken&v=1.1", {
            body: { message: "Invalid token" },
        });

        fetchMock.get("https://test.com/api0/account?scalar_token=wokentoken&v=1.1", {
            body: { user_id: client.getUserId() },
        });

        client.getOpenIdToken = jest.fn().mockResolvedValue(tokenObject);

        sac.exchangeForScalarToken = jest.fn((arg) => {
            return Promise.resolve(arg === tokenObject ? "wokentoken" : "othertoken");
        });

        await sac.connect();

        expect(sac.exchangeForScalarToken).toHaveBeenCalledWith(tokenObject);
        expect(sac.hasCredentials).toBeTruthy();
        // @ts-ignore private property
        expect(sac.scalarToken).toEqual("wokentoken");
    });

    describe("exchangeForScalarToken", () => {
        it("should return `scalar_token` from API /register", async () => {
            const sac = new ScalarAuthClient(apiUrl + 1, uiUrl);

            fetchMock.postOnce("https://test.com/api1/register?v=1.1", {
                body: { scalar_token: "stoken" },
            });

            await expect(sac.exchangeForScalarToken(tokenObject)).resolves.toBe("stoken");
        });

        it("should throw upon non-20x code", async () => {
            const sac = new ScalarAuthClient(apiUrl + 2, uiUrl);

            fetchMock.postOnce("https://test.com/api2/register?v=1.1", {
                status: 500,
            });

            await expect(sac.exchangeForScalarToken(tokenObject)).rejects.toThrow("Scalar request failed: 500");
        });

        it("should throw if scalar_token is missing in response", async () => {
            const sac = new ScalarAuthClient(apiUrl + 3, uiUrl);

            fetchMock.postOnce("https://test.com/api3/register?v=1.1", {
                body: {},
            });

            await expect(sac.exchangeForScalarToken(tokenObject)).rejects.toThrow("Missing scalar_token in response");
        });
    });

    describe("registerForToken", () => {
        it("should call `termsInteractionCallback` upon M_TERMS_NOT_SIGNED error", async () => {
            const sac = new ScalarAuthClient(apiUrl + 4, uiUrl);
            const termsInteractionCallback = jest.fn();
            sac.setTermsInteractionCallback(termsInteractionCallback);
            fetchMock.get("https://test.com/api4/account?scalar_token=testtoken1&v=1.1", {
                body: { errcode: "M_TERMS_NOT_SIGNED" },
            });
            sac.exchangeForScalarToken = jest.fn(() => Promise.resolve("testtoken1"));
            mocked(client.getTerms).mockResolvedValue({ policies: [] });

            await expect(sac.registerForToken()).resolves.toBe("testtoken1");
        });

        it("should throw upon non-20x code", async () => {
            const sac = new ScalarAuthClient(apiUrl + 5, uiUrl);
            fetchMock.get("https://test.com/api5/account?scalar_token=testtoken2&v=1.1", {
                body: { errcode: "SERVER_IS_SAD" },
                status: 500,
            });
            sac.exchangeForScalarToken = jest.fn(() => Promise.resolve("testtoken2"));

            await expect(sac.registerForToken()).rejects.toBeTruthy();
        });

        it("should throw if user_id is missing from response", async () => {
            const sac = new ScalarAuthClient(apiUrl + 6, uiUrl);
            fetchMock.get("https://test.com/api6/account?scalar_token=testtoken3&v=1.1", {
                body: {},
            });
            sac.exchangeForScalarToken = jest.fn(() => Promise.resolve("testtoken3"));

            await expect(sac.registerForToken()).rejects.toThrow("Missing user_id in response");
        });
    });

    describe("getScalarPageTitle", () => {
        let sac: ScalarAuthClient;

        beforeEach(async () => {
            SdkConfig.put({
                integrations_rest_url: apiUrl + 7,
                integrations_ui_url: uiUrl,
            });

            window.localStorage.setItem("mx_scalar_token_at_https://test.com/api7", "wokentoken1");
            fetchMock.get("https://test.com/api7/account?scalar_token=wokentoken1&v=1.1", {
                body: { user_id: client.getUserId() },
            });

            sac = new ScalarAuthClient(apiUrl + 7, uiUrl);
            await sac.connect();
        });

        it("should return `cached_title` from API /widgets/title_lookup", async () => {
            const url = "google.com";
            fetchMock.get("https://test.com/api7/widgets/title_lookup?scalar_token=wokentoken1&curl=" + url, {
                body: {
                    page_title_cache_item: {
                        cached_title: "Google",
                    },
                },
            });

            await expect(sac.getScalarPageTitle(url)).resolves.toBe("Google");
        });

        it("should throw upon non-20x code", async () => {
            const url = "yahoo.com";
            fetchMock.get("https://test.com/api7/widgets/title_lookup?scalar_token=wokentoken1&curl=" + url, {
                status: 500,
            });

            await expect(sac.getScalarPageTitle(url)).rejects.toThrow("Scalar request failed: 500");
        });
    });

    describe("disableWidgetAssets", () => {
        let sac: ScalarAuthClient;

        beforeEach(async () => {
            SdkConfig.put({
                integrations_rest_url: apiUrl + 8,
                integrations_ui_url: uiUrl,
            });

            window.localStorage.setItem("mx_scalar_token_at_https://test.com/api8", "wokentoken1");
            fetchMock.get("https://test.com/api8/account?scalar_token=wokentoken1&v=1.1", {
                body: { user_id: client.getUserId() },
            });

            sac = new ScalarAuthClient(apiUrl + 8, uiUrl);
            await sac.connect();
        });

        it("should send state=disable to API /widgets/set_assets_state", async () => {
            fetchMock.get(
                "https://test.com/api8/widgets/set_assets_state?scalar_token=wokentoken1" +
                    "&widget_type=m.custom&widget_id=id1&state=disable",
                {
                    body: "OK",
                },
            );

            await expect(sac.disableWidgetAssets(WidgetType.CUSTOM, "id1")).resolves.toBeUndefined();
        });

        it("should throw upon non-20x code", async () => {
            fetchMock.get(
                "https://test.com/api8/widgets/set_assets_state?scalar_token=wokentoken1" +
                    "&widget_type=m.custom&widget_id=id2&state=disable",
                {
                    status: 500,
                },
            );

            await expect(sac.disableWidgetAssets(WidgetType.CUSTOM, "id2")).rejects.toThrow(
                "Scalar request failed: 500",
            );
        });
    });
});
