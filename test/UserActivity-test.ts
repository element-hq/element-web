/*
Copyright 2019, 2021 New Vector Ltd

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

import FakeTimers from "@sinonjs/fake-timers";
import EventEmitter from "events";

import UserActivity from "../src/UserActivity";

class FakeDomEventEmitter extends EventEmitter {
    addEventListener(what: string, l: (...args: any[]) => void) {
        this.on(what, l);
    }

    removeEventListener(what: string, l: (...args: any[]) => void) {
        this.removeListener(what, l);
    }
}

describe("UserActivity", function () {
    let fakeWindow: FakeDomEventEmitter;
    let fakeDocument: FakeDomEventEmitter & { hasFocus?(): boolean };
    let userActivity: UserActivity;
    let clock: FakeTimers.InstalledClock;

    beforeEach(function () {
        fakeWindow = new FakeDomEventEmitter();
        fakeDocument = new FakeDomEventEmitter();
        userActivity = new UserActivity(fakeWindow as unknown as Window, fakeDocument as unknown as Document);
        userActivity.start();
        clock = FakeTimers.install();
    });

    afterEach(function () {
        userActivity.stop();
        clock.uninstall();
    });

    it("should return the same shared instance", function () {
        expect(UserActivity.sharedInstance()).toBe(UserActivity.sharedInstance());
    });

    it("should consider user inactive if no activity", function () {
        expect(userActivity.userActiveNow()).toBe(false);
    });

    it("should consider user not active recently if no activity", function () {
        expect(userActivity.userActiveRecently()).toBe(false);
    });

    it("should not consider user active after activity if no window focus", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(false);

        userActivity.onUserActivity({ type: "event" } as Event);
        expect(userActivity.userActiveNow()).toBe(false);
        expect(userActivity.userActiveRecently()).toBe(false);
    });

    it("should consider user active shortly after activity", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        expect(userActivity.userActiveNow()).toBe(true);
        expect(userActivity.userActiveRecently()).toBe(true);
        clock.tick(200);
        expect(userActivity.userActiveNow()).toBe(true);
        expect(userActivity.userActiveRecently()).toBe(true);
    });

    it("should consider user not active after 10s of no activity", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        clock.tick(10000);
        expect(userActivity.userActiveNow()).toBe(false);
    });

    it("should consider user passive after 10s of no activity", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        clock.tick(10000);
        expect(userActivity.userActiveRecently()).toBe(true);
    });

    it("should not consider user passive after 10s if window un-focused", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        clock.tick(10000);

        fakeDocument.hasFocus = jest.fn().mockReturnValue(false);
        fakeWindow.emit("blur", {});

        expect(userActivity.userActiveRecently()).toBe(false);
    });

    it("should not consider user passive after 3 mins", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        clock.tick(3 * 60 * 1000);

        expect(userActivity.userActiveRecently()).toBe(false);
    });

    it("should extend timer on activity", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        clock.tick(1 * 60 * 1000);
        userActivity.onUserActivity({ type: "event" } as Event);
        clock.tick(1 * 60 * 1000);
        userActivity.onUserActivity({ type: "event" } as Event);
        clock.tick(1 * 60 * 1000);

        expect(userActivity.userActiveRecently()).toBe(true);
    });
});
