/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import {
    Anonymity,
    getRedactedCurrentLocation,
    IEvent,
    PosthogAnalytics,
} from '../src/PosthogAnalytics';
import SdkConfig from '../src/SdkConfig';

class FakePosthog {
    public capture;
    public init;
    public identify;
    public reset;
    public register;

    constructor() {
        this.capture = jest.fn();
        this.init = jest.fn();
        this.identify = jest.fn();
        this.reset = jest.fn();
        this.register = jest.fn();
    }
}

export interface ITestEvent extends IEvent {
    eventName: "JestTestEvents";
    foo: string;
}

describe("PosthogAnalytics", () => {
    let fakePosthog: FakePosthog;
    const shaHashes = {
        "42": "73475cb40a568e8da8a045ced110137e159f890ac4da883b6b17dc651b3a8049",
        "some": "a6b46dd0d1ae5e86cbc8f37e75ceeb6760230c1ca4ffbcb0c97b96dd7d9c464b",
        "pii": "bd75b3e080945674c0351f75e0db33d1e90986fa07b318ea7edf776f5eef38d4",
        "foo": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    };

    beforeEach(() => {
        fakePosthog = new FakePosthog();

        window.crypto = {
            subtle: {
                digest: async (_, encodedMessage) => {
                    const message = new TextDecoder().decode(encodedMessage);
                    const hexHash = shaHashes[message];
                    const bytes = [];
                    for (let c = 0; c < hexHash.length; c += 2) {
                        bytes.push(parseInt(hexHash.substr(c, 2), 16));
                    }
                    return bytes;
                },
            },
        };
    });

    afterEach(() => {
        window.crypto = null;
    });

    describe("Initialisation", () => {
        it("Should not be enabled without config being set", () => {
            jest.spyOn(SdkConfig, "get").mockReturnValue({});
            const analytics = new PosthogAnalytics(fakePosthog);
            expect(analytics.isEnabled()).toBe(false);
        });

        it("Should be enabled if config is set", () => {
            jest.spyOn(SdkConfig, "get").mockReturnValue({
                posthog: {
                    projectApiKey: "foo",
                    apiHost: "bar",
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
            jest.spyOn(SdkConfig, "get").mockReturnValue({
                posthog: {
                    projectApiKey: "foo",
                    apiHost: "bar",
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
            expect(fakePosthog.capture.mock.calls[0][0]).toBe("JestTestEvents");
            expect(fakePosthog.capture.mock.calls[0][1]["foo"]).toEqual("bar");
        });

        it("Should not track events if anonymous", async () => {
            analytics.setAnonymity(Anonymity.Anonymous);
            await analytics.trackEvent<ITestEvent>({
                eventName: "JestTestEvents",
                foo: "bar",
            });
            expect(fakePosthog.capture.mock.calls.length).toBe(0);
        });

        it("Should not track any events if disabled", async () => {
            analytics.setAnonymity(Anonymity.Disabled);
            analytics.trackEvent<ITestEvent>({
                eventName: "JestTestEvents",
                foo: "bar",
            });
            expect(fakePosthog.capture.mock.calls.length).toBe(0);
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
            class FakeClient {
                getAccountDataFromServer = jest.fn().mockResolvedValue(null);
                setAccountData = jest.fn().mockResolvedValue({});
            }
            await analytics.identifyUser(new FakeClient(), () => "analytics_id" );
            expect(fakePosthog.identify.mock.calls[0][0]).toBe("analytics_id");
        });

        it("Should not identify the user to posthog if anonymous", async () => {
            analytics.setAnonymity(Anonymity.Anonymous);
            await analytics.identifyUser(null);
            expect(fakePosthog.identify.mock.calls.length).toBe(0);
        });

        it("Should identify using the server's analytics id if present", async () => {
            analytics.setAnonymity(Anonymity.Pseudonymous);
            class FakeClient {
                getAccountDataFromServer = jest.fn().mockResolvedValue({ id: "existing_analytics_id" });
                setAccountData = jest.fn().mockResolvedValue({});
            }
            await analytics.identifyUser(new FakeClient(), () => "new_analytics_id" );
            expect(fakePosthog.identify.mock.calls[0][0]).toBe("existing_analytics_id");
        });
    });
});
