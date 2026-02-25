/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";

import UserActivity from "../../src/UserActivity";

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

    beforeEach(function () {
        fakeWindow = new FakeDomEventEmitter();
        fakeDocument = new FakeDomEventEmitter();
        userActivity = new UserActivity(fakeWindow as unknown as Window, fakeDocument as unknown as Document);
        userActivity.start();
        jest.useFakeTimers();
    });

    afterEach(function () {
        userActivity.stop();
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
        jest.advanceTimersByTime(200);
        expect(userActivity.userActiveNow()).toBe(true);
        expect(userActivity.userActiveRecently()).toBe(true);
    });

    it("should consider user not active after 10s of no activity", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        jest.advanceTimersByTime(10000);
        expect(userActivity.userActiveNow()).toBe(false);
    });

    it("should consider user passive after 10s of no activity", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        jest.advanceTimersByTime(10000);
        expect(userActivity.userActiveRecently()).toBe(true);
    });

    it("should not consider user passive after 10s if window un-focused", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        jest.advanceTimersByTime(10000);

        fakeDocument.hasFocus = jest.fn().mockReturnValue(false);
        fakeWindow.emit("blur", {});

        expect(userActivity.userActiveRecently()).toBe(false);
    });

    it("should not consider user passive after 3 mins", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        jest.advanceTimersByTime(3 * 60 * 1000);

        expect(userActivity.userActiveRecently()).toBe(false);
    });

    it("should extend timer on activity", function () {
        fakeDocument.hasFocus = jest.fn().mockReturnValue(true);

        userActivity.onUserActivity({ type: "event" } as Event);
        jest.advanceTimersByTime(1 * 60 * 1000);
        userActivity.onUserActivity({ type: "event" } as Event);
        jest.advanceTimersByTime(1 * 60 * 1000);
        userActivity.onUserActivity({ type: "event" } as Event);
        jest.advanceTimersByTime(1 * 60 * 1000);

        expect(userActivity.userActiveRecently()).toBe(true);
    });
});
