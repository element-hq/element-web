import { IAnonymousEvent, IRoomEvent, PosthogAnalytics } from '../src/PosthogAnalytics';
import SdkConfig from '../src/SdkConfig';
const crypto = require('crypto');

class FakePosthog {
    public capture;
    public init;
    public identify;

    constructor() {
        this.capture = jest.fn();
        this.init = jest.fn();
        this.identify = jest.fn();
    }
}

export interface ITestEvent extends IAnonymousEvent {
    key: "jest_test_event",
    properties: {
        foo: string
    }
}

export interface ITestRoomEvent extends IRoomEvent {
    key: "jest_test_room_event",
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
        analytics.trackAnonymousEvent<ITestEvent>("jest_test_event", {
            foo: "bar",
        });
        expect(fakePosthog.capture.mock.calls[0][0]).toBe("jest_test_event");
        expect(fakePosthog.capture.mock.calls[0][1]).toEqual({ foo: "bar" });
    });

    it("Should pass trackRoomEvent to posthog", async () => {
        analytics.init(false);
        const roomId = "42";
        return analytics.trackRoomEvent<IRoomEvent>("jest_test_event", roomId, {
            foo: "bar",
        }).then(() => {
            expect(fakePosthog.capture.mock.calls[0][0]).toBe("jest_test_event");
            expect(fakePosthog.capture.mock.calls[0][1]).toEqual({
                foo: "bar",
                hashedRoomId: "73475cb40a568e8da8a045ced110137e159f890ac4da883b6b17dc651b3a8049",
            });
        });
    });

    it("Should silently not track if not inititalised", () => {
        analytics.trackAnonymousEvent<ITestEvent>("jest_test_event", {
            foo: "bar",
        });

        expect(fakePosthog.capture.mock.calls.length).toBe(0);
    });

    it("Should not track non-anonymous messages if onlyTrackAnonymousEvents is true", () => {
        analytics.trackAnonymousEvent<ITestEvent>("jest_test_event", {
            foo: "bar",
        });
    });

    it("Should identify the user to posthog if onlyTrackAnonymousEvents is false", async () => {
        analytics.init(false);
        await analytics.identifyUser("foo");
        expect(fakePosthog.identify.mock.calls[0][0])
            .toBe("2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae");
    });

    it("Should not identify the user to posthog if onlyTrackAnonymousEvents is true", async () => {
        analytics.init(true);
        return analytics.identifyUser("foo").then(() => {
            expect(fakePosthog.identify.mock.calls.length).toBe(0);
        });
    });
});
