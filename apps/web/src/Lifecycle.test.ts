/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type MockedObject } from "vitest";
import { logger } from "matrix-js-sdk/src/logger";
import * as MatrixJs from "matrix-js-sdk/src/matrix";
import { decodeBase64, encodeUnpaddedBase64, MatrixClient, OAuth2 } from "matrix-js-sdk/src/matrix";
import * as encryptAESSecretStorageItemModule from "matrix-js-sdk/src/utils/encryptAESSecretStorageItem";
import fetchMock from "@fetch-mock/vitest";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
    mockClientMethodsServer,
    mockPlatformPeg,
} from "test-utils";
import { makeDelegatedAuthMetadata } from "test-utils/auth";

import StorageEvictedDialog from "./components/views/dialogs/StorageEvictedDialog";
import * as Lifecycle from "./Lifecycle";
import { MatrixClientPeg } from "./MatrixClientPeg";
import Modal from "./Modal";
import * as StorageAccess from "./utils/StorageAccess";
import { idbSave } from "./utils/StorageAccess";
import { Action } from "./dispatcher/actions";
import PlatformPeg from "./PlatformPeg";
import { persistTokens } from "./utils/tokens/tokens";
import { encryptPickleKey } from "./utils/tokens/pickling";
import * as StorageManager from "./utils/StorageManager.ts";
import type BasePlatform from "./BasePlatform.ts";
import * as createMatrixClientModule from "./utils/createMatrixClient";

const { logout, restoreSessionFromStorage, setLoggedIn } = Lifecycle;

describe("Lifecycle", () => {
    const homeserverUrl = "https://domain";
    const identityServerUrl = "https://is.org";
    const userId = "@alice:domain";
    const deviceId = "abc123";
    const accessToken = "test-access-token";

    let mockPlatform: MockedObject<BasePlatform>;

    let mockClient!: MockedObject<MatrixJs.MatrixClient>;

    beforeEach(() => {
        mockPlatform = mockPlatformPeg();
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            ...mockClientMethodsServer(),
            stopClient: vi.fn(),
            removeAllListeners: vi.fn(),
            clearStores: vi.fn(),
            getDeviceId: vi.fn().mockReturnValue(deviceId),
            isVersionSupported: vi.fn().mockResolvedValue(true),
            getCrypto: vi.fn(),
            getThirdpartyProtocols: vi.fn(),
            store: {
                destroy: vi.fn(),
            },
            getVersions: vi.fn().mockResolvedValue({ versions: ["v1.1"] }),
            logout: vi.fn().mockResolvedValue(undefined),
            getRefreshToken: vi.fn(),
            isInitialSyncComplete: vi.fn(),
            setGuest: vi.fn(),
            setNotifTimelineSet: vi.fn(),
        });
        // stub this
        vi.spyOn(MatrixClientPeg, "set").mockImplementation(() => {});
        vi.spyOn(MatrixClientPeg, "start").mockResolvedValue(undefined);

        vi.spyOn(encryptAESSecretStorageItemModule, "default").mockRestore();

        localStorage.clear();
        sessionStorage.clear();
        vi.spyOn(MatrixClient.prototype, "getAuthMetadata").mockResolvedValue(makeDelegatedAuthMetadata());
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    const initIdbMock = (mockStore: Record<string, Record<string, unknown>> = {}): void => {
        vi.spyOn(StorageAccess, "idbLoad")
            .mockClear()
            .mockImplementation(
                // @ts-ignore mock type
                async (table: string, key: string) => mockStore[table]?.[key] ?? null,
            );
        vi.spyOn(StorageAccess, "idbSave")
            .mockClear()
            .mockImplementation(
                // @ts-ignore mock type
                async (tableKey: string, key: string, value: unknown) => {
                    const table = mockStore[tableKey] || {};
                    table[key as string] = value;
                    mockStore[tableKey] = table;
                },
            );
        vi.spyOn(StorageAccess, "idbDelete")
            .mockClear()
            .mockImplementation(async (tableKey: string, key: string | string[]) => {
                const table = mockStore[tableKey];
                delete table?.[key as string];
            });
        vi.spyOn(StorageAccess, "idbClear")
            .mockClear()
            .mockImplementation(async (tableKey: string) => {
                mockStore[tableKey] = {};
            });
    };

    const localStorageSession: Record<string, string> = {
        mx_hs_url: homeserverUrl,
        mx_is_url: identityServerUrl,
        mx_user_id: userId,
        mx_device_id: deviceId,
    };
    const idbStorageSession = {
        account: {
            mx_access_token: accessToken,
        },
    };
    const credentials = {
        homeserverUrl,
        identityServerUrl,
        userId,
        deviceId,
        accessToken,
    };

    const refreshToken = "test-refresh-token";

    const encryptedTokenShapedObject = {
        ciphertext: expect.any(String),
        iv: expect.any(String),
        mac: expect.any(String),
    };

    describe("loadSession", () => {
        beforeEach(() => {
            // stub this out
            vi.spyOn(Modal, "createDialog").mockReturnValue(
                // @ts-ignore allow bad mock
                { finished: Promise.resolve([true]) },
            );
        });

        it("should not show any error dialog when checkConsistency throws but abortSignal has triggered", async () => {
            vi.spyOn(StorageManager, "checkConsistency").mockRejectedValue(new Error("test error"));

            const abortController = new AbortController();
            const prom = Lifecycle.loadSession({
                enableGuest: true,
                guestHsUrl: "https://guest.server",
                urlParams: { guest: { guest_user_id: "a", guest_access_token: "b" } },
                abortSignal: abortController.signal,
            });
            abortController.abort();
            await expect(prom).resolves.toBeFalsy();

            expect(Modal.createDialog).not.toHaveBeenCalled();
        });
    });

    describe("restoreSessionFromStorage()", () => {
        const realLocalStorage = localStorage;

        beforeEach(() => {
            initIdbMock();

            vi.spyOn(logger, "log").mockClear();

            vi.spyOn(MatrixJs, "createClient").mockReturnValue(mockClient);
            vi.spyOn(createMatrixClientModule, "createClientWithCreds").mockReturnValue(mockClient);

            // stub this out
            vi.spyOn(Modal, "createDialog").mockReturnValue(
                // @ts-ignore allow bad mock
                { finished: Promise.resolve([true]) },
            );
        });

        afterEach(() => {
            vi.stubGlobal("localStorage", realLocalStorage);
        });

        it("should return false when localStorage is not available", async () => {
            vi.stubGlobal("localStorage", undefined);

            expect(await restoreSessionFromStorage()).toEqual(false);
        });

        it("should return false when no session data is found in local storage", async () => {
            expect(await restoreSessionFromStorage()).toEqual(false);
            expect(logger.log).toHaveBeenCalledWith("No previous session found.");
        });

        it("should abort login when we expect to find an access token but don't", async () => {
            localStorage.setItem("mx_has_access_token", "true");

            await expect(() => restoreSessionFromStorage()).rejects.toThrow();
            expect(Modal.createDialog).toHaveBeenCalledWith(StorageEvictedDialog);
            expect(mockClient.clearStores).toHaveBeenCalled();
        });

        describe("when session is found in storage", () => {
            describe("guest account", () => {
                beforeEach(() => {
                    localStorage.setItem("mx_is_guest", "true");
                    for (const key in localStorageSession) {
                        localStorage.setItem(key, localStorageSession[key]);
                    }
                    initIdbMock(idbStorageSession);
                });

                it("should ignore guest accounts when ignoreGuest is true", async () => {
                    expect(await restoreSessionFromStorage({ ignoreGuest: true })).toEqual(false);
                    expect(logger.log).toHaveBeenCalledWith(`Ignoring stored guest account: ${userId}`);
                });

                it("should restore guest accounts when ignoreGuest is false", async () => {
                    expect(await restoreSessionFromStorage({ ignoreGuest: false })).toEqual(true);

                    expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                        expect.objectContaining({
                            userId,
                            guest: true,
                        }),
                        undefined,
                    );
                    expect(localStorage.getItem("mx_is_guest")).toEqual("true");
                });
            });

            describe("without a pickle key", () => {
                beforeEach(() => {
                    for (const key in localStorageSession) {
                        localStorage.setItem(key, localStorageSession[key]);
                    }
                    initIdbMock(idbStorageSession);
                });

                it("should persist credentials", async () => {
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(localStorage.getItem("mx_user_id")).toEqual(userId);
                    expect(localStorage.getItem("mx_has_access_token")).toEqual("true");
                    expect(localStorage.getItem("mx_is_guest")).toEqual("false");
                    expect(localStorage.getItem("mx_device_id")).toEqual(deviceId);

                    expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                    // dont put accessToken in localstorage when we have idb
                    expect(localStorage.getItem("mx_access_token")).not.toEqual(accessToken);
                });

                it("should persist access token when idb is not available", async () => {
                    vi.spyOn(StorageAccess, "idbSave").mockRejectedValue("oups");
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                    // put accessToken in localstorage as fallback
                    expect(localStorage.getItem("mx_access_token")).toEqual(accessToken);
                });

                it("should create and start new matrix client with credentials", async () => {
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                        {
                            userId,
                            accessToken,
                            homeserverUrl,
                            identityServerUrl,
                            deviceId,
                            freshLogin: false,
                            guest: false,
                            pickleKey: undefined,
                        },
                        undefined,
                    );

                    expect(MatrixClientPeg.start).toHaveBeenCalledWith({});
                });

                it("should remove fresh login flag from session storage", async () => {
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(sessionStorage.getItem("mx_fresh_login")).toBeFalsy();
                });

                it("should start matrix client", async () => {
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(MatrixClientPeg.start).toHaveBeenCalled();
                });

                describe("with a refresh token", () => {
                    beforeEach(() => {
                        localStorage.setItem("mx_refresh_token", refreshToken);
                        localStorage.setItem("mx_oidc_client_id", "test-client-id");
                        for (const key in localStorageSession) {
                            localStorage.setItem(key, localStorageSession[key]);
                        }
                        initIdbMock(idbStorageSession);
                    });

                    it("should persist credentials", async () => {
                        expect(await restoreSessionFromStorage()).toEqual(true);

                        // refresh token from storage is re-persisted
                        expect(localStorage.getItem("mx_has_refresh_token")).toEqual("true");
                        expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_refresh_token", refreshToken);
                    });

                    it("should create new matrix client with credentials", async () => {
                        expect(await restoreSessionFromStorage()).toEqual(true);

                        expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                            {
                                userId,
                                accessToken,
                                // refreshToken included in credentials
                                refreshToken,
                                homeserverUrl,
                                identityServerUrl,
                                deviceId,
                                freshLogin: false,
                                guest: false,
                                pickleKey: undefined,
                            },
                            expect.any(OAuth2),
                        );
                    });
                });
            });

            describe("with a normal pickle key", () => {
                let pickleKey: string;

                beforeEach(async () => {
                    localStorage.setItem("mx_oidc_client_id", "test-client-id");
                    for (const key in localStorageSession) {
                        localStorage.setItem(key, localStorageSession[key]);
                    }
                    initIdbMock({});

                    // Create a pickle key, and store it, encrypted, in IDB.
                    pickleKey = (await PlatformPeg.get()!.createPickleKey(credentials.userId, credentials.deviceId))!;

                    // Indicate that we should have a pickle key
                    localStorage.setItem("mx_has_pickle_key", "true");

                    await persistTokens(pickleKey, credentials);
                });

                it("should persist credentials", async () => {
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(localStorage.getItem("mx_has_access_token")).toEqual("true");

                    // token encrypted and persisted
                    expect(StorageAccess.idbSave).toHaveBeenCalledWith(
                        "account",
                        "mx_access_token",
                        encryptedTokenShapedObject,
                    );
                });

                it("should persist access token when idb is not available", async () => {
                    // dont fail for pickle key persist
                    vi.spyOn(StorageAccess, "idbSave").mockImplementation(
                        async (table: string, key: string | string[]) => {
                            if (table === "account" && key === "mx_access_token") {
                                throw new Error("oups");
                            }
                        },
                    );

                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(StorageAccess.idbSave).toHaveBeenCalledWith(
                        "account",
                        "mx_access_token",
                        encryptedTokenShapedObject,
                    );
                    // put accessToken in localstorage as fallback
                    expect(localStorage.getItem("mx_access_token")).toEqual(accessToken);
                });

                it("should create and start new matrix client with credentials", async () => {
                    // Check that the rust crypto key is as expected. We have to do this during the call, as
                    // the buffer is cleared afterwards.
                    vi.mocked(MatrixClientPeg.start).mockImplementation(async (opts) => {
                        expect(opts?.rustCryptoStoreKey).toEqual(decodeBase64(pickleKey));
                    });

                    // Perform the restore
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    // Ensure that the expected calls were made
                    expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                        {
                            userId,
                            // decrypted accessToken
                            accessToken,
                            homeserverUrl,
                            identityServerUrl,
                            deviceId,
                            freshLogin: false,
                            guest: false,
                            pickleKey,
                        },
                        expect.any(OAuth2),
                    );

                    expect(MatrixClientPeg.start).toHaveBeenCalledWith({ rustCryptoStoreKey: expect.any(Uint8Array) });
                });

                describe("with a refresh token", () => {
                    beforeEach(async () => {
                        await persistTokens(pickleKey, { ...credentials, refreshToken });
                    });

                    it("should persist credentials", async () => {
                        expect(await restoreSessionFromStorage()).toEqual(true);

                        // refresh token from storage is re-persisted
                        expect(localStorage.getItem("mx_has_refresh_token")).toEqual("true");
                        expect(StorageAccess.idbSave).toHaveBeenCalledWith(
                            "account",
                            "mx_refresh_token",
                            encryptedTokenShapedObject,
                        );
                    });

                    it("should create new matrix client with credentials", async () => {
                        expect(await restoreSessionFromStorage()).toEqual(true);

                        expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                            {
                                userId,
                                accessToken,
                                // refreshToken included in credentials
                                refreshToken,
                                homeserverUrl,
                                identityServerUrl,
                                deviceId,
                                freshLogin: false,
                                guest: false,
                                pickleKey: pickleKey,
                            },
                            expect.any(OAuth2),
                        );
                    });
                });
            });

            describe("with a non-standard pickle key", () => {
                // Most pickle keys are 43 bytes of base64. Test what happens when it is something else.
                let pickleKey: string;

                beforeEach(async () => {
                    for (const key in localStorageSession) {
                        localStorage.setItem(key, localStorageSession[key]);
                    }
                    initIdbMock({});

                    // Generate the pickle key. I don't *think* it's possible for there to be a pickle key
                    // which is not some amount of base64.
                    const rawPickleKey = new Uint8Array(10);
                    crypto.getRandomValues(rawPickleKey);
                    pickleKey = encodeUnpaddedBase64(rawPickleKey);

                    // Store it, encrypted, in the db
                    await idbSave(
                        "pickleKey",
                        [userId, deviceId],
                        (await encryptPickleKey(rawPickleKey, userId, deviceId))!,
                    );

                    // Indicate that we should have a pickle key
                    localStorage.setItem("mx_has_pickle_key", "true");

                    await persistTokens(pickleKey, credentials);
                });

                it("should create and start new matrix client with credentials", async () => {
                    // Perform the restore
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    // Ensure that the expected calls were made
                    expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                        {
                            userId,
                            // decrypted accessToken
                            accessToken,
                            homeserverUrl,
                            identityServerUrl,
                            deviceId,
                            freshLogin: false,
                            guest: false,
                            pickleKey,
                        },
                        undefined,
                    );

                    expect(MatrixClientPeg.start).toHaveBeenCalledWith({ rustCryptoStorePassword: pickleKey });
                });
            });

            it("should proceed if server is not accessible", async () => {
                for (const key in localStorageSession) {
                    localStorage.setItem(key, localStorageSession[key]);
                }
                initIdbMock(idbStorageSession);
                mockClient.isVersionSupported.mockRejectedValue(new Error("Oh, noes, the server is down!"));

                expect(await restoreSessionFromStorage()).toEqual(true);
            });

            it("should throw if the token was persisted with a pickle key but there is no pickle key available now", async () => {
                for (const key in localStorageSession) {
                    localStorage.setItem(key, localStorageSession[key]);
                }
                initIdbMock({});

                // Create a pickle key, and store it, encrypted, in IDB.
                const pickleKey = (await PlatformPeg.get()!.createPickleKey(credentials.userId, credentials.deviceId))!;
                localStorage.setItem("mx_has_pickle_key", "true");
                await persistTokens(pickleKey, credentials);

                // Now destroy the pickle key
                await PlatformPeg.get()!.destroyPickleKey(credentials.userId, credentials.deviceId);

                await expect(restoreSessionFromStorage()).rejects.toThrow(
                    "Error decrypting secret access_token: no pickle key found.",
                );
            });
        });
    });

    describe("setLoggedIn()", () => {
        beforeEach(() => {
            initIdbMock();

            vi.clearAllMocks();
            vi.spyOn(logger, "log").mockClear();

            vi.spyOn(MatrixJs, "createClient").mockReturnValue(mockClient);
            // remove any mock implementations
            vi.spyOn(mockPlatform, "createPickleKey").mockRestore();
            // but still spy and call through
            vi.spyOn(mockPlatform, "createPickleKey");
        });

        const refreshToken = "test-refresh-token";

        it("should remove fresh login flag from session storage", async () => {
            await setLoggedIn(credentials);

            expect(sessionStorage.getItem("mx_fresh_login")).toBeFalsy();
        });

        it("should start matrix client", async () => {
            await setLoggedIn(credentials);

            expect(MatrixClientPeg.start).toHaveBeenCalled();
        });

        describe("after a soft-logout", () => {
            beforeEach(async () => {
                await setLoggedIn(credentials);
                localStorage.setItem("mx_soft_logout", "true");
            });

            it("should not clear the storage if device is the same", async () => {
                await Lifecycle.hydrateSession(credentials);

                expect(localStorage.getItem("mx_soft_logout")).toBeFalsy();
                expect(mockClient.getUserId).toHaveReturnedWith(userId);
                expect(mockClient.getDeviceId).toHaveReturnedWith(deviceId);
                expect(mockClient.clearStores).toHaveBeenCalledTimes(1);
            });

            it("should clear the storage if device is not the same", async () => {
                const fakeCredentials = {
                    homeserverUrl,
                    identityServerUrl,
                    userId: "@bob:domain",
                    deviceId,
                    accessToken,
                };
                await Lifecycle.hydrateSession(fakeCredentials);

                expect(localStorage.getItem("mx_soft_logout")).toBeFalsy();
                expect(mockClient.getUserId).toHaveReturnedWith(userId);
                expect(mockClient.getDeviceId).toHaveReturnedWith(deviceId);
                expect(mockClient.clearStores).toHaveBeenCalledTimes(2);
            });
        });

        describe("without a pickle key", () => {
            beforeEach(() => {
                vi.spyOn(mockPlatform, "createPickleKey").mockResolvedValue(null);
                vi.spyOn(createMatrixClientModule, "createClientWithCreds").mockReturnValue(mockClient);
            });

            it("should persist credentials", async () => {
                await setLoggedIn(credentials);

                expect(localStorage.getItem("mx_user_id")).toEqual(userId);
                expect(localStorage.getItem("mx_has_access_token")).toEqual("true");
                expect(localStorage.getItem("mx_is_guest")).toEqual("false");
                expect(localStorage.getItem("mx_device_id")).toEqual(deviceId);

                expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                // dont put accessToken in localstorage when we have idb
                expect(localStorage.getItem("mx_access_token")).not.toEqual(accessToken);
            });

            it("should persist a refreshToken when present", async () => {
                localStorage.setItem("mx_oidc_client_id", "test-client-id");

                await setLoggedIn({
                    ...credentials,
                    refreshToken,
                });

                expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_refresh_token", refreshToken);
                // dont put accessToken in localstorage when we have idb
                expect(localStorage.getItem("mx_access_token")).not.toEqual(accessToken);
            });

            it("should remove any access token from storage when there is none in credentials and idb save fails", async () => {
                vi.spyOn(StorageAccess, "idbSave").mockRejectedValue("oups");
                await setLoggedIn({
                    ...credentials,
                    // @ts-ignore
                    accessToken: undefined,
                });

                expect(localStorage.getItem("mx_has_access_token")).toBeFalsy();
                expect(localStorage.getItem("mx_access_token")).toBeFalsy();
            });

            it("should clear stores", async () => {
                await setLoggedIn(credentials);

                expect(StorageAccess.idbClear).toHaveBeenCalledWith("account");
                expect(sessionStorage.length).toBe(0);
                expect(mockClient.clearStores).toHaveBeenCalled();
            });

            it("should create new matrix client with credentials", async () => {
                expect(await setLoggedIn(credentials)).toEqual(mockClient);

                expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                    {
                        userId,
                        accessToken,
                        homeserverUrl,
                        identityServerUrl,
                        deviceId,
                        freshLogin: true,
                        guest: false,
                        pickleKey: undefined,
                    },
                    undefined,
                );
            });
        });

        describe("with a pickle key", () => {
            it("should not create a pickle key when credentials do not include deviceId", async () => {
                await setLoggedIn({
                    ...credentials,
                    deviceId: undefined,
                });

                // unpickled access token saved
                expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                expect(mockPlatform.createPickleKey).not.toHaveBeenCalled();
            });

            it("creates a pickle key with userId and deviceId", async () => {
                await setLoggedIn(credentials);

                expect(mockPlatform.createPickleKey).toHaveBeenCalledWith(userId, deviceId);
            });

            it("should persist credentials", async () => {
                await setLoggedIn(credentials);

                expect(localStorage.getItem("mx_user_id")).toEqual(userId);
                expect(localStorage.getItem("mx_has_access_token")).toEqual("true");
                expect(localStorage.getItem("mx_is_guest")).toEqual("false");
                expect(localStorage.getItem("mx_device_id")).toEqual(deviceId);

                expect(localStorage.getItem("mx_has_pickle_key")).toEqual("true");
                expect(StorageAccess.idbSave).toHaveBeenCalledWith(
                    "account",
                    "mx_access_token",
                    encryptedTokenShapedObject,
                );
                expect(StorageAccess.idbSave).toHaveBeenCalledWith("pickleKey", [userId, deviceId], expect.any(Object));
                // dont put accessToken in localstorage when we have idb
                expect(localStorage.getItem("mx_access_token")).not.toEqual(accessToken);
            });

            it("should persist token when encrypting the token fails", async () => {
                vi.spyOn(encryptAESSecretStorageItemModule, "default").mockRejectedValue("MOCK REJECT ENCRYPTAES");
                await setLoggedIn(credentials);

                // persist the unencrypted token
                expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
            });

            it("should persist token in localStorage when idb fails to save token", async () => {
                // dont fail for pickle key persist
                vi.spyOn(StorageAccess, "idbSave").mockImplementation(async (table: string, key: string | string[]) => {
                    if (table === "account" && key === "mx_access_token") {
                        throw new Error("oups");
                    }
                });
                await setLoggedIn(credentials);

                // put plain accessToken in localstorage when we dont have idb
                expect(localStorage.getItem("mx_access_token")).toEqual(accessToken);
            });

            it("should remove any access token from storage when there is none in credentials and idb save fails", async () => {
                // dont fail for pickle key persist
                vi.spyOn(StorageAccess, "idbSave").mockImplementation(async (table: string, key: string | string[]) => {
                    if (table === "account" && key === "mx_access_token") {
                        throw new Error("oups");
                    }
                });
                await setLoggedIn({
                    ...credentials,
                    // @ts-ignore
                    accessToken: undefined,
                });

                expect(localStorage.getItem("mx_has_access_token")).toBeFalsy();
                expect(localStorage.getItem("mx_access_token")).toBeFalsy();
            });

            it("should create new matrix client with credentials", async () => {
                vi.spyOn(createMatrixClientModule, "createClientWithCreds").mockReturnValue(mockClient);
                expect(await setLoggedIn(credentials)).toEqual(mockClient);

                expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                    {
                        userId,
                        accessToken,
                        homeserverUrl,
                        identityServerUrl,
                        deviceId,
                        freshLogin: true,
                        guest: false,
                        pickleKey: expect.any(String),
                    },
                    undefined,
                );
            });
        });

        // XXX: these tests are broken, Lifecycle.setLoggedIn does not work with OIDC and its token refreshers due to clearing storage
        describe.skip("when authenticated via OIDC native flow", () => {
            const clientId = "test-client-id";
            const issuer = "https://auth.com/";

            const delegatedAuthConfig = makeDelegatedAuthMetadata(issuer);

            beforeEach(() => {
                // set values in local storage as they would be after a successful oidc authentication
                localStorage.setItem("mx_oidc_client_id", clientId);
            });

            it("should not try to create a token refresher without a refresh token", async () => {
                const cli = await setLoggedIn(credentials);

                // didn't try to initialise token refresher
                expect(cli.http.opts.tokenRefreshFunction).toBeUndefined();
            });

            it("should not try to create a token refresher without a deviceId", async () => {
                await expect(
                    setLoggedIn({
                        ...credentials,
                        refreshToken,
                        deviceId: undefined,
                    }),
                ).rejects.toThrow("Expected deviceId in user credentials.");

                // didn't try to initialise token refresher
                expect(fetchMock).toHaveFetchedTimes(
                    0,
                    `${delegatedAuthConfig.issuer}.well-known/openid-configuration`,
                );
            });

            it("should not try to create a token refresher without an issuer in session storage", async () => {
                await expect(
                    setLoggedIn({
                        ...credentials,
                        refreshToken,
                    }),
                ).rejects.toThrow("Cannot create an OIDC token refresher as no stored OIDC token issuer was found.");

                // didn't try to initialise token refresher
                expect(fetchMock).toHaveFetchedTimes(
                    0,
                    `${delegatedAuthConfig.issuer}.well-known/openid-configuration`,
                );
            });

            it("should create a client with a tokenRefreshFunction", async () => {
                expect(
                    await setLoggedIn({
                        ...credentials,
                        refreshToken,
                    }),
                ).toEqual(mockClient);

                expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                    expect.objectContaining({
                        accessToken,
                        refreshToken,
                    }),
                    expect.any(Function),
                );
            });

            it("should create a client when creating token refresher fails", async () => {
                // create invalid value in local storage for a malformed oidc authentication
                localStorage.removeItem("mx_oidc_client_id");

                // succeeded
                expect(
                    await setLoggedIn({
                        ...credentials,
                        refreshToken,
                    }),
                ).toEqual(mockClient);

                expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                    expect.objectContaining({
                        accessToken,
                        refreshToken,
                    }),
                    // no token refresh function
                    undefined,
                );
            });
        });
    });

    describe("logout()", () => {
        const accessToken = "test-access-token";
        const refreshToken = "test-refresh-token";

        beforeEach(() => {
            mockClient.getAccessToken.mockReturnValue(accessToken);
            mockClient.getRefreshToken.mockReturnValue(refreshToken);
            vi.spyOn(OAuth2.prototype, "revokeToken").mockResolvedValue(undefined);
        });

        it("should call logout on the client when oauth is not used", async () => {
            logout();

            await flushPromises();

            expect(mockClient.logout).toHaveBeenCalledWith(true);
        });

        it("should revoke tokens when user is authenticated with oauth2", async () => {
            localStorage.setItem("mx_oidc_client_id", "test-client-id");
            logout();

            await flushPromises();

            expect(mockClient.logout).not.toHaveBeenCalled();
            expect(OAuth2.prototype.revokeToken).toHaveBeenCalledWith(accessToken, "access_token");
            expect(OAuth2.prototype.revokeToken).toHaveBeenCalledWith(refreshToken, "refresh_token");
        });
    });

    describe("overwritelogin", () => {
        beforeEach(async () => {
            vi.spyOn(MatrixJs, "createClient").mockReturnValue(mockClient);
        });

        it("should replace the current login with a new one", async () => {
            const stopSpy = vi.spyOn(mockClient, "stopClient").mockReturnValue(undefined);
            vi.spyOn(createMatrixClientModule, "createClientWithCreds").mockReturnValue(mockClient);
            const dis = window.mxDispatcher;

            const firstLoginEvent: Promise<void> = new Promise((resolve) => {
                dis.register(({ action }) => {
                    if (action === Action.OnLoggedIn) {
                        resolve();
                    }
                });
            });
            // set a logged in state
            await setLoggedIn(credentials);

            await firstLoginEvent;

            expect(stopSpy).toHaveBeenCalledTimes(1);
            // important the overwrite action should not call unset before replacing.
            // So spy on it and make sure it's not called.
            vi.spyOn(MatrixClientPeg, "unset").mockReturnValue(undefined);

            expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId,
                }),
                undefined,
            );

            const otherCredentials = {
                ...credentials,
                userId: "@bob:server.org",
                deviceId: "def456",
            };

            const secondLoginEvent: Promise<void> = new Promise((resolve) => {
                dis.register(({ action }) => {
                    if (action === Action.OnLoggedIn) {
                        resolve();
                    }
                });
            });

            // Trigger the overwrite login action
            dis.dispatch(
                {
                    action: "overwrite_login",
                    credentials: otherCredentials,
                },
                true,
            );

            await secondLoginEvent;
            // the client should have been stopped
            expect(stopSpy).toHaveBeenCalledTimes(2);

            expect(createMatrixClientModule.createClientWithCreds).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: otherCredentials.userId,
                }),
                undefined,
            );

            expect(MatrixClientPeg.unset).not.toHaveBeenCalled();
        });
    });
});
