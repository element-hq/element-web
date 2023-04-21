/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { logger } from "matrix-js-sdk/src/logger";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { UpdateCheckStatus } from "matrix-react-sdk/src/BasePlatform";
import { Action } from "matrix-react-sdk/src/dispatcher/actions";
import dispatcher from "matrix-react-sdk/src/dispatcher/dispatcher";
import * as rageshake from "matrix-react-sdk/src/rageshake/rageshake";
import { BreadcrumbsStore } from "matrix-react-sdk/src/stores/BreadcrumbsStore";

import ElectronPlatform from "../../../../src/vector/platform/ElectronPlatform";

jest.mock("matrix-react-sdk/src/rageshake/rageshake", () => ({
    flush: jest.fn(),
}));

describe("ElectronPlatform", () => {
    const defaultUserAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36";
    const mockElectron = {
        on: jest.fn(),
        send: jest.fn(),
    };

    const dispatchSpy = jest.spyOn(dispatcher, "dispatch");
    const dispatchFireSpy = jest.spyOn(dispatcher, "fire");
    const logSpy = jest.spyOn(logger, "log").mockImplementation(() => {});

    const userId = "@alice:server.org";
    const deviceId = "device-id";

    beforeEach(() => {
        window.electron = mockElectron;
        jest.clearAllMocks();
        Object.defineProperty(window, "navigator", { value: { userAgent: defaultUserAgent }, writable: true });
    });

    const getElectronEventHandlerCall = (eventType: string): [type: string, handler: Function] | undefined =>
        mockElectron.on.mock.calls.find(([type]) => type === eventType);

    it("flushes rageshake before quitting", () => {
        new ElectronPlatform();
        const [event, handler] = getElectronEventHandlerCall("before-quit")!;
        // correct event bound
        expect(event).toBeTruthy();

        handler();

        expect(logSpy).toHaveBeenCalled();
        expect(rageshake.flush).toHaveBeenCalled();
    });

    it("dispatches view settings action on preferences event", () => {
        new ElectronPlatform();
        const [event, handler] = getElectronEventHandlerCall("preferences")!;
        // correct event bound
        expect(event).toBeTruthy();

        handler();

        expect(dispatchFireSpy).toHaveBeenCalledWith(Action.ViewUserSettings);
    });

    describe("updates", () => {
        it("dispatches on check updates action", () => {
            new ElectronPlatform();
            const [event, handler] = getElectronEventHandlerCall("check_updates")!;
            // correct event bound
            expect(event).toBeTruthy();

            handler({}, true);
            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.CheckUpdates,
                status: UpdateCheckStatus.Downloading,
            });
        });

        it("dispatches on check updates action when update not available", () => {
            new ElectronPlatform();
            const [, handler] = getElectronEventHandlerCall("check_updates")!;

            handler({}, false);
            expect(dispatchSpy).toHaveBeenCalledWith({
                action: Action.CheckUpdates,
                status: UpdateCheckStatus.NotAvailable,
            });
        });

        it("starts update check", () => {
            const platform = new ElectronPlatform();
            platform.startUpdateCheck();
            expect(mockElectron.send).toHaveBeenCalledWith("check_updates");
        });

        it("installs update", () => {
            const platform = new ElectronPlatform();
            platform.installUpdate();
            expect(mockElectron.send).toHaveBeenCalledWith("install_update");
        });
    });

    it("returns human readable name", () => {
        const platform = new ElectronPlatform();
        expect(platform.getHumanReadableName()).toEqual("Electron Platform");
    });

    describe("getDefaultDeviceDisplayName", () => {
        it.each([
            [
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
                "Element Desktop: macOS",
            ],
            [
                "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "electron/1.0.0 Chrome/53.0.2785.113 Electron/1.4.3 Safari/537.36",
                "Element Desktop: Windows",
            ],
            ["Mozilla/5.0 (X11; Linux i686; rv:21.0) Gecko/20100101 Firefox/21.0", "Element Desktop: Linux"],
            ["Mozilla/5.0 (X11; FreeBSD i686; rv:21.0) Gecko/20100101 Firefox/21.0", "Element Desktop: FreeBSD"],
            ["Mozilla/5.0 (X11; OpenBSD i686; rv:21.0) Gecko/20100101 Firefox/21.0", "Element Desktop: OpenBSD"],
            ["Mozilla/5.0 (X11; SunOS i686; rv:21.0) Gecko/20100101 Firefox/21.0", "Element Desktop: SunOS"],
            ["custom user agent", "Element Desktop: Unknown"],
        ])("%s = %s", (userAgent, result) => {
            Object.defineProperty(window, "navigator", { value: { userAgent }, writable: true });
            const platform = new ElectronPlatform();
            expect(platform.getDefaultDeviceDisplayName()).toEqual(result);
        });
    });

    it("returns true for needsUrlTooltips", () => {
        const platform = new ElectronPlatform();
        expect(platform.needsUrlTooltips()).toBe(true);
    });

    it("should override browser shortcuts", () => {
        const platform = new ElectronPlatform();
        expect(platform.overrideBrowserShortcuts()).toBe(true);
    });

    it("allows overriding native context menus", () => {
        const platform = new ElectronPlatform();
        expect(platform.allowOverridingNativeContextMenus()).toBe(true);
    });

    it("indicates support for desktop capturer", () => {
        const platform = new ElectronPlatform();
        expect(platform.supportsDesktopCapturer()).toBe(true);
    });

    it("indicates no support for jitsi screensharing", () => {
        const platform = new ElectronPlatform();
        expect(platform.supportsJitsiScreensharing()).toBe(false);
    });

    describe("notifications", () => {
        it("indicates support for notifications", () => {
            const platform = new ElectronPlatform();
            expect(platform.supportsNotifications()).toBe(true);
        });

        it("may send notifications", () => {
            const platform = new ElectronPlatform();
            expect(platform.maySendNotifications()).toBe(true);
        });

        it("pretends to request notification permission", async () => {
            const platform = new ElectronPlatform();
            const result = await platform.requestNotificationPermission();
            expect(result).toEqual("granted");
        });

        it("creates a loud notification", async () => {
            const platform = new ElectronPlatform();
            platform.loudNotification(new MatrixEvent(), new Room("!room:server", {} as any, userId));
            expect(mockElectron.send).toHaveBeenCalledWith("loudNotification");
        });

        it("sets notification count when count is changing", async () => {
            const platform = new ElectronPlatform();
            platform.setNotificationCount(0);
            // not called because matches internal notificaiton count
            expect(mockElectron.send).not.toHaveBeenCalledWith("setBadgeCount", 0);
            platform.setNotificationCount(1);
            expect(mockElectron.send).toHaveBeenCalledWith("setBadgeCount", 1);
        });
    });

    describe("spellcheck", () => {
        it("indicates support for spellcheck settings", () => {
            const platform = new ElectronPlatform();
            expect(platform.supportsSpellCheckSettings()).toBe(true);
        });

        it("gets available spellcheck languages", () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear();
            platform.getAvailableSpellCheckLanguages();

            const [channel, { name }] = mockElectron.send.mock.calls[0];
            expect(channel).toEqual("ipcCall");
            expect(name).toEqual("getAvailableSpellCheckLanguages");
        });
    });

    describe("pickle key", () => {
        it("makes correct ipc call to get pickle key", () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear();
            platform.getPickleKey(userId, deviceId);

            const [, { name, args }] = mockElectron.send.mock.calls[0];
            expect(name).toEqual("getPickleKey");
            expect(args).toEqual([userId, deviceId]);
        });

        it("makes correct ipc call to create pickle key", () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear();
            platform.createPickleKey(userId, deviceId);

            const [, { name, args }] = mockElectron.send.mock.calls[0];
            expect(name).toEqual("createPickleKey");
            expect(args).toEqual([userId, deviceId]);
        });

        it("makes correct ipc call to destroy pickle key", () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear();
            platform.destroyPickleKey(userId, deviceId);

            const [, { name, args }] = mockElectron.send.mock.calls[0];
            expect(name).toEqual("destroyPickleKey");
            expect(args).toEqual([userId, deviceId]);
        });
    });

    describe("versions", () => {
        it("calls install update", () => {
            const platform = new ElectronPlatform();
            platform.installUpdate();

            expect(mockElectron.send).toHaveBeenCalledWith("install_update");
        });
    });

    describe("breacrumbs", () => {
        it("should send breadcrumb updates over the IPC", () => {
            const spy = jest.spyOn(BreadcrumbsStore.instance, "on");
            new ElectronPlatform();
            const cb = spy.mock.calls[0][1];
            cb();

            expect(mockElectron.send).toHaveBeenCalledWith(
                "ipcCall",
                expect.objectContaining({
                    name: "breadcrumbs",
                }),
            );
        });
    });
});
