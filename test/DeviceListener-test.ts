
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

import { EventEmitter } from "events";
import { mocked } from "jest-mock";
import { Room } from "matrix-js-sdk/src/matrix";

import DeviceListener from "../src/DeviceListener";
import { MatrixClientPeg } from "../src/MatrixClientPeg";
import * as SetupEncryptionToast from "../src/toasts/SetupEncryptionToast";
import * as UnverifiedSessionToast from "../src/toasts/UnverifiedSessionToast";
import * as BulkUnverifiedSessionsToast from "../src/toasts/BulkUnverifiedSessionsToast";
import { isSecretStorageBeingAccessed } from "../src/SecurityManager";
import dis from "../src/dispatcher/dispatcher";
import { Action } from "../src/dispatcher/actions";

// don't litter test console with logs
jest.mock("matrix-js-sdk/src/logger");

jest.mock("../src/dispatcher/dispatcher", () => ({
    dispatch: jest.fn(),
    register: jest.fn(),
}));

jest.mock("../src/SecurityManager", () => ({
    isSecretStorageBeingAccessed: jest.fn(), accessSecretStorage: jest.fn(),
}));

class MockClient extends EventEmitter {
    getUserId = jest.fn();
    getKeyBackupVersion = jest.fn().mockResolvedValue(undefined);
    getRooms = jest.fn().mockReturnValue([]);
    doesServerSupportUnstableFeature = jest.fn().mockResolvedValue(true);
    isCrossSigningReady = jest.fn().mockResolvedValue(true);
    isSecretStorageReady = jest.fn().mockResolvedValue(true);
    isCryptoEnabled = jest.fn().mockReturnValue(true);
    isInitialSyncComplete = jest.fn().mockReturnValue(true);
    getKeyBackupEnabled = jest.fn();
    getStoredDevicesForUser = jest.fn().mockReturnValue([]);
    getCrossSigningId = jest.fn();
    getStoredCrossSigningForUser = jest.fn();
    waitForClientWellKnown = jest.fn();
    downloadKeys = jest.fn();
    isRoomEncrypted = jest.fn();
    getClientWellKnown = jest.fn();
}
const mockDispatcher = mocked(dis);
const flushPromises = async () => await new Promise(process.nextTick);

describe('DeviceListener', () => {
    let mockClient;

    // spy on various toasts' hide and show functions
    // easier than mocking
    jest.spyOn(SetupEncryptionToast, 'showToast');
    jest.spyOn(SetupEncryptionToast, 'hideToast');
    jest.spyOn(BulkUnverifiedSessionsToast, 'showToast');
    jest.spyOn(BulkUnverifiedSessionsToast, 'hideToast');
    jest.spyOn(UnverifiedSessionToast, 'showToast');
    jest.spyOn(UnverifiedSessionToast, 'hideToast');

    beforeEach(() => {
        jest.resetAllMocks();
        mockClient = new MockClient();
        jest.spyOn(MatrixClientPeg, 'get').mockReturnValue(mockClient);
    });

    const createAndStart = async (): Promise<DeviceListener> => {
        const instance = new DeviceListener();
        instance.start();
        await flushPromises();
        return instance;
    };

    describe('recheck', () => {
        it('does nothing when cross signing feature is not supported', async () => {
            mockClient.doesServerSupportUnstableFeature.mockResolvedValue(false);
            await createAndStart();

            expect(mockClient.isCrossSigningReady).not.toHaveBeenCalled();
        });
        it('does nothing when crypto is not enabled', async () => {
            mockClient.isCryptoEnabled.mockReturnValue(false);
            await createAndStart();

            expect(mockClient.isCrossSigningReady).not.toHaveBeenCalled();
        });
        it('does nothing when initial sync is not complete', async () => {
            mockClient.isInitialSyncComplete.mockReturnValue(false);
            await createAndStart();

            expect(mockClient.isCrossSigningReady).not.toHaveBeenCalled();
        });

        describe('set up encryption', () => {
            const rooms = [
                { roomId: '!room1' },
                { roomId: '!room2' },
            ] as unknown as Room[];

            beforeEach(() => {
                mockClient.isCrossSigningReady.mockResolvedValue(false);
                mockClient.isSecretStorageReady.mockResolvedValue(false);
                mockClient.getRooms.mockReturnValue(rooms);
                mockClient.isRoomEncrypted.mockReturnValue(true);
            });

            it('hides setup encryption toast when cross signing and secret storage are ready', async () => {
                mockClient.isCrossSigningReady.mockResolvedValue(true);
                mockClient.isSecretStorageReady.mockResolvedValue(true);
                await createAndStart();
                expect(SetupEncryptionToast.hideToast).toHaveBeenCalled();
            });

            it('hides setup encryption toast when it is dismissed', async () => {
                const instance = await createAndStart();
                instance.dismissEncryptionSetup();
                await flushPromises();
                expect(SetupEncryptionToast.hideToast).toHaveBeenCalled();
            });

            it('does not do any checks or show any toasts when secret storage is being accessed', async () => {
                mocked(isSecretStorageBeingAccessed).mockReturnValue(true);
                await createAndStart();

                expect(mockClient.downloadKeys).not.toHaveBeenCalled();
                expect(SetupEncryptionToast.showToast).not.toHaveBeenCalled();
            });

            it('does not do any checks or show any toasts when no rooms are encrypted', async () => {
                mockClient.isRoomEncrypted.mockReturnValue(false);
                await createAndStart();

                expect(mockClient.downloadKeys).not.toHaveBeenCalled();
                expect(SetupEncryptionToast.showToast).not.toHaveBeenCalled();
            });

            describe('when user does not have a cross signing id on this device', () => {
                beforeEach(() => {
                    mockClient.getCrossSigningId.mockReturnValue(undefined);
                });

                it('shows verify session toast when account has cross signing', async () => {
                    mockClient.getStoredCrossSigningForUser.mockReturnValue(true);
                    await createAndStart();

                    expect(mockClient.downloadKeys).toHaveBeenCalled();
                    expect(SetupEncryptionToast.showToast).toHaveBeenCalledWith(
                        SetupEncryptionToast.Kind.VERIFY_THIS_SESSION);
                });

                it('checks key backup status when when account has cross signing', async () => {
                    mockClient.getCrossSigningId.mockReturnValue(undefined);
                    mockClient.getStoredCrossSigningForUser.mockReturnValue(true);
                    await createAndStart();

                    expect(mockClient.getKeyBackupEnabled).toHaveBeenCalled();
                });
            });

            describe('when user does have a cross signing id on this device', () => {
                beforeEach(() => {
                    mockClient.getCrossSigningId.mockReturnValue('abc');
                });

                it('shows upgrade encryption toast when user has a key backup available', async () => {
                    // non falsy response
                    mockClient.getKeyBackupVersion.mockResolvedValue({});
                    await createAndStart();

                    expect(SetupEncryptionToast.showToast).toHaveBeenCalledWith(
                        SetupEncryptionToast.Kind.UPGRADE_ENCRYPTION);
                });
            });
        });

        describe('key backup status', () => {
            it('checks keybackup status when cross signing and secret storage are ready', async () => {
                // default mocks set cross signing and secret storage to ready
                await createAndStart();
                expect(mockClient.getKeyBackupEnabled).toHaveBeenCalled();
                expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
            });

            it('checks keybackup status when setup encryption toast has been dismissed', async () => {
                mockClient.isCrossSigningReady.mockResolvedValue(false);
                const instance = await createAndStart();

                instance.dismissEncryptionSetup();
                await flushPromises();

                expect(mockClient.getKeyBackupEnabled).toHaveBeenCalled();
            });

            it('does not dispatch keybackup event when key backup check is not finished', async () => {
                // returns null when key backup status hasn't finished being checked
                mockClient.getKeyBackupEnabled.mockReturnValue(null);
                await createAndStart();
                expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
            });

            it('dispatches keybackup event when key backup is not enabled', async () => {
                mockClient.getKeyBackupEnabled.mockReturnValue(false);
                await createAndStart();
                expect(mockDispatcher.dispatch).toHaveBeenCalledWith({ action: Action.ReportKeyBackupNotEnabled });
            });

            it('does not check key backup status again after check is complete', async () => {
                mockClient.getKeyBackupEnabled.mockReturnValue(null);
                const instance = await createAndStart();
                expect(mockClient.getKeyBackupEnabled).toHaveBeenCalled();

                // keyback check now complete
                mockClient.getKeyBackupEnabled.mockReturnValue(true);

                // trigger a recheck
                instance.dismissEncryptionSetup();
                await flushPromises();
                expect(mockClient.getKeyBackupEnabled).toHaveBeenCalledTimes(2);

                // trigger another recheck
                instance.dismissEncryptionSetup();
                await flushPromises();
                // not called again, check was complete last time
                expect(mockClient.getKeyBackupEnabled).toHaveBeenCalledTimes(2);
            });
        });
    });
});
