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

import request from 'browser-request';
import EventEmitter from 'events';
import { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk/src/matrix';
import { UpdateCheckStatus } from 'matrix-react-sdk/src/BasePlatform';
import { MatrixClientPeg } from 'matrix-react-sdk/src/MatrixClientPeg';

import ElectronPlatform from '../../../../src/vector/platform/ElectronPlatform';

class MockElectron extends EventEmitter {
    send = jest.fn();
}

describe('ElectronPlatform', () => {
    const defaultUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36';
    const mockElectron = new MockElectron();

    const userId = '@alice:server.org';
    const deviceId = 'device-id';

    window.electron = mockElectron;
    beforeEach(() => {
        window.electron = mockElectron;
        jest.clearAllMocks();
        delete window.navigator;
        window.navigator = { userAgent: defaultUserAgent } as unknown as Navigator;
    });

    it('returns human readable name', () => {
        const platform = new ElectronPlatform();
        expect(platform.getHumanReadableName()).toEqual('Electron Platform');
    });

    describe("getDefaultDeviceDisplayName", () => {
        it.each([[
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
            "Element Desktop: macOS",
        ],
        [
            "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) electron/1.0.0 Chrome/53.0.2785.113 Electron/1.4.3 Safari/537.36",
            "Element Desktop: Windows",
        ],
        [
            "Mozilla/5.0 (X11; Linux i686; rv:21.0) Gecko/20100101 Firefox/21.0",
            "Element Desktop: Linux",
        ],
        [
            "Mozilla/5.0 (X11; FreeBSD i686; rv:21.0) Gecko/20100101 Firefox/21.0",
            "Element Desktop: FreeBSD",
        ],
        [
            "Mozilla/5.0 (X11; OpenBSD i686; rv:21.0) Gecko/20100101 Firefox/21.0",
            "Element Desktop: OpenBSD",
        ],
        [
            "Mozilla/5.0 (X11; SunOS i686; rv:21.0) Gecko/20100101 Firefox/21.0",
            "Element Desktop: SunOS",
        ],
        [
            "custom user agent",
            "Element Desktop: Unknown",
        ],

    ])("%s = %s", (userAgent, result) => {
            delete window.navigator;
            window.navigator = { userAgent } as unknown as Navigator;
            const platform = new ElectronPlatform();
            expect(platform.getDefaultDeviceDisplayName()).toEqual(result);
        });
    });

    it('returns true for needsUrlTooltips', () => {
        const platform = new ElectronPlatform();
        expect(platform.needsUrlTooltips()).toBe(true);
    });

    it('should override browser shortcuts', () => {
        const platform = new ElectronPlatform();
        expect(platform.overrideBrowserShortcuts()).toBe(true);
    });

    it('allows overriding native context menus', () => {
        const platform = new ElectronPlatform();
        expect(platform.allowOverridingNativeContextMenus()).toBe(true);
    });

    it('indicates support for desktop capturer', () => {
        const platform = new ElectronPlatform();
        expect(platform.supportsDesktopCapturer()).toBe(true);
    });

    it('indicates no support for jitsi screensharing', () => {
        const platform = new ElectronPlatform();
        expect(platform.supportsJitsiScreensharing()).toBe(false);
    });

    describe('notifications', () => {
        it('indicates support for notifications', () => {
            const platform = new ElectronPlatform();
            expect(platform.supportsNotifications()).toBe(true);
        });

        it('may send notifications', () => {
            const platform = new ElectronPlatform();
            expect(platform.maySendNotifications()).toBe(true);
        });

        it('pretends to request notification permission', async () => {
            const platform = new ElectronPlatform();
            const result = await platform.requestNotificationPermission();
            expect(result).toEqual('granted');
        });

        it('creates a loud notification', async () => {
            const platform = new ElectronPlatform();
            platform.loudNotification(new MatrixEvent(), new Room('!room:server', {} as any, userId));
            expect(mockElectron.send).toHaveBeenCalledWith('loudNotification');
        });
    });

    describe('spellcheck', () => {
        it('indicates support for spellcheck settings', () => {
            const platform = new ElectronPlatform();
            expect(platform.supportsSpellCheckSettings()).toBe(true);
        });

        it('gets available spellcheck languages', () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear();
            platform.getAvailableSpellCheckLanguages();

            const [channel, { name }] = mockElectron.send.mock.calls[0];
            expect(channel).toEqual("ipcCall");
            expect(name).toEqual('getAvailableSpellCheckLanguages')
        });
    });

    describe('pickle key', () => {
        it('makes correct ipc call to get pickle key', () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear();
            platform.getPickleKey(userId, deviceId);

            const [, { name, args }] = mockElectron.send.mock.calls[0];
            expect(name).toEqual('getPickleKey')
            expect(args).toEqual([userId, deviceId])
        });

        it('catches error and returns null when getPickleKey rejects', async () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear().mockImplementation(() => { throw new Error('oups') });
            const result = await platform.getPickleKey(userId, deviceId);

            expect(result).toEqual(null);
        });

        it('makes correct ipc call to create pickle key', () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear();
            platform.createPickleKey(userId, deviceId);

            const [, { name, args }] = mockElectron.send.mock.calls[0];
            expect(name).toEqual('createPickleKey')
            expect(args).toEqual([userId, deviceId])
        });

        it('catches error and returns null when createPickleKey rejects', async () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear().mockImplementation(() => { throw new Error('oups') });
            const result = await platform.createPickleKey(userId, deviceId);

            expect(result).toEqual(null);
        });

        it('makes correct ipc call to destroy pickle key', () => {
            const platform = new ElectronPlatform();
            mockElectron.send.mockClear();
            platform.destroyPickleKey(userId, deviceId);

            const [, { name, args }] = mockElectron.send.mock.calls[0];
            expect(name).toEqual('destroyPickleKey')
            expect(args).toEqual([userId, deviceId])
        });
    });

    describe('versions', () => {
        it('calls install update', () => {
            const platform = new ElectronPlatform();
            platform.installUpdate();

            expect(mockElectron.send).toHaveBeenCalledWith('install_update');
        });
    });
});
