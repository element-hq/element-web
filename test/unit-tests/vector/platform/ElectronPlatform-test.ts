/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { mocked, type MockedObject } from "jest-mock";
import { waitFor } from "jest-matrix-react";

import { UpdateCheckStatus } from "../../../../src/BasePlatform";
import { Action } from "../../../../src/dispatcher/actions";
import dispatcher from "../../../../src/dispatcher/dispatcher";
import * as rageshake from "../../../../src/rageshake/rageshake";
import { BreadcrumbsStore } from "../../../../src/stores/BreadcrumbsStore";
import Modal from "../../../../src/Modal";
import DesktopCapturerSourcePicker from "../../../../src/components/views/elements/DesktopCapturerSourcePicker";
import ElectronPlatform from "../../../../src/vector/platform/ElectronPlatform";
import { setupLanguageMock } from "../../../setup/setupLanguage";
import { stubClient } from "../../../test-utils";
import ToastStore from "../../../../src/stores/ToastStore.ts";

jest.mock("../../../../src/rageshake/rageshake", () => ({
    flush: jest.fn(),
}));

describe("ElectronPlatform", () => {
    const initialiseValues = jest.fn().mockReturnValue({
        protocol: "io.element.desktop",
        sessionId: "session-id",
        config: { _config: true },
        supportedSettings: { setting1: false, setting2: true },
        supportsBadgeOverlay: false,
    });
    const defaultUserAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36";
    const mockElectron = {
        on: jest.fn(),
        send: jest.fn(),
        initialise: initialiseValues,
        setSettingValue: jest.fn().mockResolvedValue(undefined),
        getSettingValue: jest.fn().mockResolvedValue(undefined),
    } as unknown as MockedObject<Electron>;

    const dispatchSpy = jest.spyOn(dispatcher, "dispatch");
    const dispatchFireSpy = jest.spyOn(dispatcher, "fire");
    const logSpy = jest.spyOn(logger, "log").mockImplementation(() => {});

    const userId = "@alice:server.org";
    const deviceId = "device-id";

    beforeEach(() => {
        window.electron = mockElectron;
        jest.clearAllMocks();
        Object.defineProperty(window, "navigator", { value: { userAgent: defaultUserAgent }, writable: true });
        setupLanguageMock();
    });

    const getElectronEventHandlerCall = (
        eventType: string,
    ): [type: string, handler: (...args: any) => void] | undefined =>
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

    it("should load config", async () => {
        const platform = new ElectronPlatform();
        await expect(platform.getConfig()).resolves.toEqual({ _config: true });
    });

    it("should return oidc client state as expected", async () => {
        const platform = new ElectronPlatform();
        await platform.getConfig();
        expect(platform.getOidcClientState()).toMatchInlineSnapshot(`":element-desktop-ssoid:session-id"`);
    });

    it("dispatches view settings action on preferences event", () => {
        new ElectronPlatform();
        const [event, handler] = getElectronEventHandlerCall("preferences")!;
        // correct event bound
        expect(event).toBeTruthy();

        handler();

        expect(dispatchFireSpy).toHaveBeenCalledWith(Action.ViewUserSettings);
    });

    it("creates a modal on openDesktopCapturerSourcePicker", async () => {
        const plat = new ElectronPlatform();
        Modal.createDialog = jest.fn();

        // @ts-ignore mock
        mocked(Modal.createDialog).mockReturnValue({
            finished: new Promise((r) => r(["source"])),
        });

        let res: () => void;
        const waitForIPCSend = new Promise<void>((r) => {
            res = r;
        });
        // @ts-ignore mock
        jest.spyOn(plat.ipc, "call").mockImplementation(() => {
            res();
        });

        const [event, handler] = getElectronEventHandlerCall("openDesktopCapturerSourcePicker")!;
        handler();

        await waitForIPCSend;

        expect(event).toBeTruthy();
        expect(Modal.createDialog).toHaveBeenCalledWith(DesktopCapturerSourcePicker);
        // @ts-ignore mock
        expect(plat.ipc.call).toHaveBeenCalledWith("callDisplayMediaCallback", "source");
    });

    it("should show a toast when showToast is fired", async () => {
        new ElectronPlatform();
        dispatcher.dispatch(
            {
                action: "client_started",
            },
            true,
        );
        const spy = jest.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");

        const [event, handler] = getElectronEventHandlerCall("showToast")!;
        handler({} as any, { title: "title", description: "description" });

        expect(event).toBeTruthy();
        await waitFor(() =>
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: "title",
                    props: expect.objectContaining({ description: "description" }),
                }),
            ),
        );
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

    describe("breadcrumbs", () => {
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

    describe("authenticated media", () => {
        it("should respond to relevant ipc requests", async () => {
            const cli = stubClient();
            mocked(cli.getAccessToken).mockReturnValue("access_token");
            mocked(cli.getHomeserverUrl).mockReturnValue("homeserver_url");
            mocked(cli.getVersions).mockResolvedValue({
                versions: ["v1.1"],
                unstable_features: {},
            });

            new ElectronPlatform();

            const userAccessTokenCall = mockElectron.on.mock.calls.find((call) => call[0] === "userAccessToken");
            userAccessTokenCall![1]({} as any);
            const userAccessTokenResponse = mockElectron.send.mock.calls.find((call) => call[0] === "userAccessToken");
            expect(userAccessTokenResponse![1]).toBe("access_token");

            const homeserverUrlCall = mockElectron.on.mock.calls.find((call) => call[0] === "homeserverUrl");
            homeserverUrlCall![1]({} as any);
            const homeserverUrlResponse = mockElectron.send.mock.calls.find((call) => call[0] === "homeserverUrl");
            expect(homeserverUrlResponse![1]).toBe("homeserver_url");

            const serverSupportedVersionsCall = mockElectron.on.mock.calls.find(
                (call) => call[0] === "serverSupportedVersions",
            );
            await (serverSupportedVersionsCall![1]({} as any) as unknown as Promise<unknown>);
            const serverSupportedVersionsResponse = mockElectron.send.mock.calls.find(
                (call) => call[0] === "serverSupportedVersions",
            );
            expect(serverSupportedVersionsResponse![1]).toEqual({ versions: ["v1.1"], unstable_features: {} });
        });
    });

    describe("settings", () => {
        let platform: ElectronPlatform;
        beforeAll(async () => {
            window.electron = mockElectron;
            platform = new ElectronPlatform();
            await platform.getConfig(); // await init
        });

        it("supportsSetting should return true for the platform", () => {
            expect(platform.supportsSetting()).toBe(true);
        });

        it("supportsSetting should return true for available settings", () => {
            expect(platform.supportsSetting("setting2")).toBe(true);
        });

        it("supportsSetting should return false for unavailable settings", () => {
            expect(platform.supportsSetting("setting1")).toBe(false);
        });

        it("should read setting value over ipc", async () => {
            mockElectron.getSettingValue.mockResolvedValue("value");
            await expect(platform.getSettingValue("setting2")).resolves.toEqual("value");
            expect(mockElectron.getSettingValue).toHaveBeenCalledWith("setting2");
        });

        it("should write setting value over ipc", async () => {
            await platform.setSettingValue("setting2", "newValue");
            expect(mockElectron.setSettingValue).toHaveBeenCalledWith("setting2", "newValue");
        });
    });

    it("should forward call_state dispatcher events via ipc", async () => {
        new ElectronPlatform();

        dispatcher.dispatch(
            {
                action: "call_state",
                state: "connected",
            },
            true,
        );

        const ipcMessage = mockElectron.send.mock.calls.find((call) => call[0] === "app_onAction");
        expect(ipcMessage![1]).toEqual({
            action: "call_state",
            state: "connected",
        });
    });

    describe("Notification overlay badges", () => {
        beforeEach(() => {
            initialiseValues.mockReturnValue({
                protocol: "io.element.desktop",
                sessionId: "session-id",
                config: { _config: true },
                supportsBadgeOverlay: true,
            });
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should send a badge with a notification count", async () => {
            const platform = new ElectronPlatform();
            await platform.initialised;
            platform.setNotificationCount(1);
            // Badges are sent asynchronously
            await waitFor(() => {
                const ipcMessage = mockElectron.send.mock.lastCall;
                expect(ipcMessage?.[1]).toEqual(1);
                expect(ipcMessage?.[2] instanceof ArrayBuffer).toEqual(true);
            });
        });

        it("should update badge and skip duplicates", async () => {
            const platform = new ElectronPlatform();
            await platform.initialised;
            platform.setNotificationCount(1);
            platform.setNotificationCount(1); // Test that duplicates do not fire.
            platform.setNotificationCount(2);
            // Badges are sent asynchronously
            await waitFor(() => {
                const [ipcMessageA, ipcMessageB] = mockElectron.send.mock.calls.filter(
                    (call) => call[0] === "setBadgeCount",
                );

                expect(ipcMessageA?.[1]).toEqual(1);
                expect(ipcMessageA?.[2] instanceof ArrayBuffer).toEqual(true);

                expect(ipcMessageB?.[1]).toEqual(2);
                expect(ipcMessageB?.[2] instanceof ArrayBuffer).toEqual(true);
            });
        });
        it("should remove badge when notification count zeros", async () => {
            const platform = new ElectronPlatform();
            await platform.initialised;
            platform.setNotificationCount(1);
            platform.setNotificationCount(0); // Test that duplicates do not fire.
            // Badges are sent asynchronously
            await waitFor(() => {
                const [ipcMessageB, ipcMessageA] = mockElectron.send.mock.calls.filter(
                    (call) => call[0] === "setBadgeCount",
                );

                expect(ipcMessageA?.[1]).toEqual(1);
                expect(ipcMessageA?.[2] instanceof ArrayBuffer).toEqual(true);

                expect(ipcMessageB?.[1]).toEqual(0);
                expect(ipcMessageB?.[2]).toBeNull();
            });
        });
        it("should show an error badge when the application errors", async () => {
            const platform = new ElectronPlatform();
            await platform.initialised;
            platform.setErrorStatus(true);
            // Badges are sent asynchronously
            await waitFor(() => {
                const ipcMessage = mockElectron.send.mock.calls.find((call) => call[0] === "setBadgeCount");

                expect(ipcMessage?.[1]).toEqual(0);
                expect(ipcMessage?.[2] instanceof ArrayBuffer).toEqual(true);
                expect(ipcMessage?.[3]).toEqual(true);
            });
        });
        it("should restore after error is resolved", async () => {
            const platform = new ElectronPlatform();
            await platform.initialised;
            platform.setErrorStatus(true);
            platform.setErrorStatus(false);
            // Badges are sent asynchronously
            await waitFor(() => {
                const [ipcMessageB, ipcMessageA] = mockElectron.send.mock.calls.filter(
                    (call) => call[0] === "setBadgeCount",
                );

                expect(ipcMessageA?.[1]).toEqual(0);
                expect(ipcMessageA?.[2] instanceof ArrayBuffer).toEqual(true);
                expect(ipcMessageA?.[3]).toEqual(true);

                expect(ipcMessageB?.[1]).toEqual(0);
                expect(ipcMessageB?.[2]).toBeNull();
            });
        });
    });
});
