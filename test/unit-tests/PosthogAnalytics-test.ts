/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type PostHog } from "posthog-js";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";

import {
    Anonymity,
    getRedactedCurrentLocation,
    type IPosthogEvent,
    PosthogAnalytics,
} from "../../src/PosthogAnalytics";
import SdkConfig from "../../src/SdkConfig";
import { getMockClientWithEventEmitter } from "../test-utils";
import SettingsStore from "../../src/settings/SettingsStore";
import { Layout } from "../../src/settings/enums/Layout";
import defaultDispatcher from "../../src/dispatcher/dispatcher";
import { Action } from "../../src/dispatcher/actions";
import { SettingLevel } from "../../src/settings/SettingLevel";

const getFakePosthog = (): PostHog =>
    ({
        capture: jest.fn(),
        init: jest.fn(),
        identify: jest.fn(),
        reset: jest.fn(),
        register: jest.fn(),
        get_distinct_id: jest.fn(),
        persistence: {
            get_property: jest.fn(),
        },
        identifyUser: jest.fn(),
    }) as unknown as PostHog;

interface ITestEvent extends IPosthogEvent {
    eventName: "JestTestEvents";
    foo?: string;
}

describe("PosthogAnalytics", () => {
    let fakePosthog: PostHog;
    const shaHashes: Record<string, string> = {
        "42": "73475cb40a568e8da8a045ced110137e159f890ac4da883b6b17dc651b3a8049",
        "some": "a6b46dd0d1ae5e86cbc8f37e75ceeb6760230c1ca4ffbcb0c97b96dd7d9c464b",
        "pii": "bd75b3e080945674c0351f75e0db33d1e90986fa07b318ea7edf776f5eef38d4",
        "foo": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    };

    beforeEach(() => {
        fakePosthog = getFakePosthog();

        Object.defineProperty(window, "crypto", {
            value: {
                subtle: {
                    digest: async (_: AlgorithmIdentifier, encodedMessage: BufferSource) => {
                        const message = new TextDecoder().decode(encodedMessage);
                        const hexHash = shaHashes[message];
                        const bytes: number[] = [];
                        for (let c = 0; c < hexHash.length; c += 2) {
                            bytes.push(parseInt(hexHash.slice(c, c + 2), 16));
                        }
                        return bytes;
                    },
                },
            },
        });
    });

    afterEach(() => {
        Object.defineProperty(window, "crypto", {
            value: null,
        });
        SdkConfig.reset(); // we touch the config, so clean up
    });

    describe("Initialisation", () => {
        it("Should not be enabled without config being set", () => {
            // force empty/invalid state for posthog options
            SdkConfig.put({ brand: "Testing" });
            const analytics = new PosthogAnalytics(fakePosthog);
            expect(analytics.isEnabled()).toBe(false);
        });

        it("Should be enabled if config is set", () => {
            SdkConfig.put({
                brand: "Testing",
                posthog: {
                    project_api_key: "foo",
                    api_host: "bar",
                },
            });
            const analytics = new PosthogAnalytics(fakePosthog);
            analytics.setAnonymity(Anonymity.Pseudonymous);
            expect(analytics.isEnabled()).toBe(true);
        });
    });

    describe("Tracking", () => {
        let analytics: PosthogAnalytics;

        beforeEach(() => {
            SdkConfig.put({
                brand: "Testing",
                posthog: {
                    project_api_key: "foo",
                    api_host: "bar",
                },
            });

            analytics = new PosthogAnalytics(fakePosthog);
        });

        it("Should pass event to posthog", () => {
            analytics.setAnonymity(Anonymity.Pseudonymous);
            analytics.trackEvent<ITestEvent>({
                eventName: "JestTestEvents",
                foo: "bar",
            });
            expect(mocked(fakePosthog).capture.mock.calls[0][0]).toBe("JestTestEvents");
            expect(mocked(fakePosthog).capture.mock.calls[0][1]!["foo"]).toEqual("bar");
        });

        it("Should not track events if anonymous", async () => {
            analytics.setAnonymity(Anonymity.Anonymous);
            await analytics.trackEvent<ITestEvent>({
                eventName: "JestTestEvents",
                foo: "bar",
            });
            expect(fakePosthog.capture).not.toHaveBeenCalled();
        });

        it("Should not track any events if disabled", async () => {
            analytics.setAnonymity(Anonymity.Disabled);
            analytics.trackEvent<ITestEvent>({
                eventName: "JestTestEvents",
                foo: "bar",
            });
            expect(fakePosthog.capture).not.toHaveBeenCalled();
        });

        it("Should anonymise location of a known screen", async () => {
            const location = getRedactedCurrentLocation("https://foo.bar", "#/register/some/pii", "/");
            expect(location).toBe("https://foo.bar/#/register/<redacted>");
        });

        it("Should anonymise location of an unknown screen", async () => {
            const location = getRedactedCurrentLocation("https://foo.bar", "#/not_a_screen_name/some/pii", "/");
            expect(location).toBe("https://foo.bar/#/<redacted_screen_name>/<redacted>");
        });

        it("Should handle an empty hash", async () => {
            const location = getRedactedCurrentLocation("https://foo.bar", "", "/");
            expect(location).toBe("https://foo.bar/");
        });

        it("Should identify the user to posthog if pseudonymous", async () => {
            analytics.setAnonymity(Anonymity.Pseudonymous);
            const client = getMockClientWithEventEmitter({
                getAccountDataFromServer: jest.fn().mockResolvedValue(null),
                setAccountData: jest.fn().mockResolvedValue({}),
            });
            await analytics.identifyUser(client, () => "analytics_id");
            expect(mocked(fakePosthog).identify.mock.calls[0][0]).toBe("analytics_id");
        });

        it("Should not identify the user to posthog if anonymous", async () => {
            analytics.setAnonymity(Anonymity.Anonymous);
            const client = getMockClientWithEventEmitter({});
            await analytics.identifyUser(client, () => "analytics_id");
            expect(mocked(fakePosthog).identify.mock.calls.length).toBe(0);
        });

        it("Should identify using the server's analytics id if present", async () => {
            analytics.setAnonymity(Anonymity.Pseudonymous);

            const client = getMockClientWithEventEmitter({
                getAccountDataFromServer: jest.fn().mockResolvedValue({ id: "existing_analytics_id" }),
                setAccountData: jest.fn().mockResolvedValue({}),
            });
            await analytics.identifyUser(client, () => "new_analytics_id");
            expect(mocked(fakePosthog).identify.mock.calls[0][0]).toBe("existing_analytics_id");
        });
    });

    describe("WebLayout", () => {
        let analytics: PosthogAnalytics;

        beforeEach(() => {
            SdkConfig.put({
                brand: "Testing",
                posthog: {
                    project_api_key: "foo",
                    api_host: "bar",
                },
            });

            analytics = new PosthogAnalytics(fakePosthog);
            analytics.setAnonymity(Anonymity.Pseudonymous);
        });

        it("should send layout IRC correctly", async () => {
            await SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            defaultDispatcher.dispatch(
                {
                    action: Action.SettingUpdated,
                    settingName: "layout",
                },
                true,
            );
            analytics.trackEvent<ITestEvent>({
                eventName: "JestTestEvents",
            });
            expect(mocked(fakePosthog).capture.mock.calls[0][1]!["$set"]).toStrictEqual({
                WebLayout: "IRC",
            });
        });

        it("should send layout Bubble correctly", async () => {
            await SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            defaultDispatcher.dispatch(
                {
                    action: Action.SettingUpdated,
                    settingName: "layout",
                },
                true,
            );
            analytics.trackEvent<ITestEvent>({
                eventName: "JestTestEvents",
            });
            expect(mocked(fakePosthog).capture.mock.calls[0][1]!["$set"]).toStrictEqual({
                WebLayout: "Bubble",
            });
        });

        it("should send layout Group correctly", async () => {
            await SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            defaultDispatcher.dispatch(
                {
                    action: Action.SettingUpdated,
                    settingName: "layout",
                },
                true,
            );
            analytics.trackEvent<ITestEvent>({
                eventName: "JestTestEvents",
            });
            expect(mocked(fakePosthog).capture.mock.calls[0][1]!["$set"]).toStrictEqual({
                WebLayout: "Group",
            });
        });

        it("should send layout Compact correctly", async () => {
            await SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            defaultDispatcher.dispatch(
                {
                    action: Action.SettingUpdated,
                    settingName: "useCompactLayout",
                },
                true,
            );
            analytics.trackEvent<ITestEvent>({
                eventName: "JestTestEvents",
            });
            expect(mocked(fakePosthog).capture.mock.calls[0][1]!["$set"]).toStrictEqual({
                WebLayout: "Compact",
            });
        });
    });

    describe("CryptoSdk", () => {
        let analytics: PosthogAnalytics;
        const getFakeClient = (): MatrixClient =>
            ({
                getCrypto: jest.fn(),
                setAccountData: jest.fn(),
                // just fake return an `im.vector.analytics` content
                getAccountDataFromServer: jest.fn().mockReturnValue({
                    id: "0000000",
                    pseudonymousAnalyticsOptIn: true,
                }),
            }) as unknown as MatrixClient;

        beforeEach(async () => {
            SdkConfig.put({
                brand: "Testing",
                posthog: {
                    project_api_key: "foo",
                    api_host: "bar",
                },
            });

            analytics = new PosthogAnalytics(fakePosthog);
        });

        // `updateAnonymityFromSettings` is called On page load / login / account data change.
        // We manually call it so we can test the behaviour.
        async function simulateLogin(rustBackend: boolean, pseudonymous = true) {
            // To simulate a switch we call updateAnonymityFromSettings.
            // As per documentation this function is called On login.
            const mockClient = getFakeClient();
            mocked(mockClient.getCrypto).mockReturnValue({
                getVersion: () => {
                    return rustBackend ? "Rust SDK 0.6.0 (9c6b550), Vodozemac 0.5.0" : "Olm 3.2.0";
                },
            } as unknown as CryptoApi);
            await analytics.updateAnonymityFromSettings(mockClient, pseudonymous);
        }

        it("should send rust cryptoSDK superProperty correctly", async () => {
            analytics.setAnonymity(Anonymity.Pseudonymous);

            await simulateLogin(false);

            expect(mocked(fakePosthog).register.mock.lastCall![0]["cryptoSDK"]).toStrictEqual("Legacy");
        });

        it("should send Legacy cryptoSDK superProperty correctly", async () => {
            analytics.setAnonymity(Anonymity.Pseudonymous);

            await simulateLogin(false);

            // Super Properties are properties associated with events that are set once and then sent with every capture call.
            // They are set using posthog.register
            expect(mocked(fakePosthog).register.mock.lastCall![0]["cryptoSDK"]).toStrictEqual("Legacy");
        });

        it("should send cryptoSDK superProperty when enabling analytics", async () => {
            analytics.setAnonymity(Anonymity.Disabled);

            await simulateLogin(true, false);

            // This initial call is due to the call to register platformSuperProperties
            // The important thing is that the cryptoSDK superProperty is not set.
            expect(mocked(fakePosthog).register.mock.lastCall![0]).toStrictEqual({});

            // switching to pseudonymous should ensure that the cryptoSDK superProperty is set correctly
            analytics.setAnonymity(Anonymity.Pseudonymous);
            // Super Properties are properties associated with events that are set once and then sent with every capture call.
            // They are set using posthog.register
            expect(mocked(fakePosthog).register.mock.lastCall![0]["cryptoSDK"]).toStrictEqual("Rust");
        });
    });
});
