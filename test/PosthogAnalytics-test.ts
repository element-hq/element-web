import { IEvent, PosthogAnalytics } from '../src/PosthogAnalytics';
import SdkConfig from '../src/SdkConfig';
const crypto = require('crypto');

class FakePosthog {
    public capture;
    public init;

    constructor() {
        this.capture = jest.fn();
        this.init = jest.fn();
    }
}

export interface ITestEvent extends IEvent {
    key: "jest_test_event",
    properties: {
        foo: string
    }
}

describe("PosthogAnalytics", () => {
    let analytics: PosthogAnalytics;
    let fakePosthog: FakePosthog;

    beforeEach(() => {
        fakePosthog = new FakePosthog();
        analytics = new PosthogAnalytics(fakePosthog);
        window.crypto = {
            subtle: crypto.webcrypto.subtle,
        };
    });

    afterEach(() => {
        navigator.doNotTrack = null;
        window.crypto = null;
    });

    it("Should not initialise if DNT is enabled", () => {
        navigator.doNotTrack = "1";
        analytics.init(false);
        expect(analytics.isInitialised()).toBe(false);
    });

    it("Should not initialise if config is not set", () => {
        jest.spyOn(SdkConfig, "get").mockReturnValue({});
        analytics.init(false);
        expect(analytics.isInitialised()).toBe(false);
    });

    it("Should initialise if config is set", () => {
        jest.spyOn(SdkConfig, "get").mockReturnValue({
            posthog: {
                projectApiKey: "foo",
                apiHost: "bar",
            },
        });
        analytics.init(false);
        expect(analytics.isInitialised()).toBe(true);
    });

    it("Should pass track() to posthog", () => {
        analytics.init(false);
        analytics.track<ITestEvent>("jest_test_event", {
            foo: "bar",
        });
        expect(fakePosthog.capture.mock.calls[0][0]).toBe("jest_test_event");
        expect(fakePosthog.capture.mock.calls[0][1]).toEqual({ foo: "bar" });
    });

    it("Should pass trackRoomEvent to posthog", () => {
        analytics.init(false);
        const roomId = "42";
        return analytics.trackRoomEvent<ITestEvent>("jest_test_event", roomId, {
            foo: "bar",
        }).then(() => {
            expect(fakePosthog.capture.mock.calls[0][0]).toBe("jest_test_event");
            expect(fakePosthog.capture.mock.calls[0][1]).toEqual({
                foo: "bar",
                hashedRoomId: "73475cb40a568e8da8a045ced110137e159f890ac4da883b6b17dc651b3a8049",
            });
        });
    });

    it("Should silently not send messages if not inititalised", () => {
        analytics.track<ITestEvent>("jest_test_event", {
            foo: "bar",
        });

        expect(fakePosthog.capture.mock.calls.length).toBe(0);
    });
});
