/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Crypto } from "@peculiar/webcrypto";
import { logger } from "matrix-js-sdk/src/logger";
import * as MatrixJs from "matrix-js-sdk/src/matrix";
import { decodeBase64, encodeUnpaddedBase64 } from "matrix-js-sdk/src/matrix";
import * as encryptAESSecretStorageItemModule from "matrix-js-sdk/src/utils/encryptAESSecretStorageItem";
import { mocked, type MockedObject } from "jest-mock";
import fetchMock from "fetch-mock-jest";

import StorageEvictedDialog from "../../src/components/views/dialogs/StorageEvictedDialog";
import * as Lifecycle from "../../src/Lifecycle";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import Modal from "../../src/Modal";
import * as StorageAccess from "../../src/utils/StorageAccess";
import { idbSave } from "../../src/utils/StorageAccess";
import { flushPromises, getMockClientWithEventEmitter, mockClientMethodsUser, mockPlatformPeg } from "../test-utils";
import { OidcClientStore } from "../../src/stores/oidc/OidcClientStore";
import { makeDelegatedAuthConfig } from "../test-utils/oidc";
import { persistOidcAuthenticatedSettings } from "../../src/utils/oidc/persistOidcSettings";
import { Action } from "../../src/dispatcher/actions";
import PlatformPeg from "../../src/PlatformPeg";
import { persistAccessTokenInStorage, persistRefreshTokenInStorage } from "../../src/utils/tokens/tokens";
import { encryptPickleKey } from "../../src/utils/tokens/pickling";
import * as StorageManager from "../../src/utils/StorageManager.ts";
import type BasePlatform from "../../src/BasePlatform.ts";

const { logout, restoreSessionFromStorage, setLoggedIn } = Lifecycle;

const webCrypto = new Crypto();

const windowCrypto = window.crypto;

describe("Lifecycle", () => {
    let mockPlatform: MockedObject<BasePlatform>;

    const realLocalStorage = global.localStorage;

    let mockClient!: MockedObject<MatrixJs.MatrixClient>;

    beforeEach(() => {
        jest.restoreAllMocks();
        mockPlatform = mockPlatformPeg();
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            stopClient: jest.fn(),
            removeAllListeners: jest.fn(),
            clearStores: jest.fn(),
            getAccountData: jest.fn(),
            getDeviceId: jest.fn(),
            isVersionSupported: jest.fn().mockResolvedValue(true),
            getCrypto: jest.fn(),
            getClientWellKnown: jest.fn(),
            waitForClientWellKnown: jest.fn(),
            getThirdpartyProtocols: jest.fn(),
            store: {
                destroy: jest.fn(),
            },
            getVersions: jest.fn().mockResolvedValue({ versions: ["v1.1"] }),
            logout: jest.fn().mockResolvedValue(undefined),
            getAccessToken: jest.fn(),
            getRefreshToken: jest.fn(),
        });
        // stub this
        jest.spyOn(MatrixClientPeg, "replaceUsingCreds").mockImplementation(() => {});
        jest.spyOn(MatrixClientPeg, "start").mockResolvedValue(undefined);

        // reset any mocking
        // @ts-ignore mocking
        delete global.localStorage;
        global.localStorage = realLocalStorage;

        // @ts-ignore mocking
        delete window.crypto;
        window.crypto = webCrypto;

        jest.spyOn(encryptAESSecretStorageItemModule, "default").mockRestore();
    });

    afterAll(() => {
        // @ts-ignore unmocking
        delete window.crypto;
        window.crypto = windowCrypto;
    });

    const initLocalStorageMock = (mockStore: Record<string, unknown> = {}): void => {
        jest.spyOn(localStorage.__proto__, "getItem")
            .mockClear()
            .mockImplementation((key: unknown) => mockStore[key as string] ?? null);
        jest.spyOn(localStorage.__proto__, "removeItem")
            .mockClear()
            .mockImplementation((key: unknown) => {
                const { [key as string]: toRemove, ...newStore } = mockStore;
                mockStore = newStore;
                return toRemove;
            });
        jest.spyOn(localStorage.__proto__, "setItem")
            .mockClear()
            .mockImplementation((key: unknown, value: unknown) => {
                mockStore[key as string] = value;
            });
    };

    const initSessionStorageMock = (mockStore: Record<string, unknown> = {}): void => {
        jest.spyOn(sessionStorage.__proto__, "getItem")
            .mockClear()
            .mockImplementation((key: unknown) => mockStore[key as string] ?? null);
        jest.spyOn(sessionStorage.__proto__, "removeItem")
            .mockClear()
            .mockImplementation((key: unknown) => {
                const { [key as string]: toRemove, ...newStore } = mockStore;
                mockStore = newStore;
                return toRemove;
            });
        jest.spyOn(sessionStorage.__proto__, "setItem")
            .mockClear()
            .mockImplementation((key: unknown, value: unknown) => {
                mockStore[key as string] = value;
            });
        jest.spyOn(sessionStorage.__proto__, "clear").mockClear();
    };

    const initIdbMock = (mockStore: Record<string, Record<string, unknown>> = {}): void => {
        jest.spyOn(StorageAccess, "idbLoad")
            .mockClear()
            .mockImplementation(
                // @ts-ignore mock type
                async (table: string, key: string) => mockStore[table]?.[key] ?? null,
            );
        jest.spyOn(StorageAccess, "idbSave")
            .mockClear()
            .mockImplementation(
                // @ts-ignore mock type
                async (tableKey: string, key: string, value: unknown) => {
                    const table = mockStore[tableKey] || {};
                    table[key as string] = value;
                    mockStore[tableKey] = table;
                },
            );
        jest.spyOn(StorageAccess, "idbDelete")
            .mockClear()
            .mockImplementation(async (tableKey: string, key: string | string[]) => {
                const table = mockStore[tableKey];
                delete table?.[key as string];
            });
        jest.spyOn(StorageAccess, "idbClear")
            .mockClear()
            .mockImplementation(async (tableKey: string) => {
                mockStore[tableKey] = {};
            });
    };

    const homeserverUrl = "https://server.org";
    const identityServerUrl = "https://is.org";
    const userId = "@alice:server.org";
    const deviceId = "abc123";
    const accessToken = "test-access-token";
    const localStorageSession = {
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
            jest.spyOn(Modal, "createDialog").mockReturnValue(
                // @ts-ignore allow bad mock
                { finished: Promise.resolve([true]) },
            );
        });

        it("should not show any error dialog when checkConsistency throws but abortSignal has triggered", async () => {
            jest.spyOn(StorageManager, "checkConsistency").mockRejectedValue(new Error("test error"));

            const abortController = new AbortController();
            const prom = Lifecycle.loadSession({
                enableGuest: true,
                guestHsUrl: "https://guest.server",
                fragmentQueryParams: { guest_user_id: "a", guest_access_token: "b" },
                abortSignal: abortController.signal,
            });
            abortController.abort();
            await expect(prom).resolves.toBeFalsy();

            expect(Modal.createDialog).not.toHaveBeenCalled();
        });
    });

    describe("restoreSessionFromStorage()", () => {
        beforeEach(() => {
            initLocalStorageMock();
            initSessionStorageMock();
            initIdbMock();

            jest.clearAllMocks();
            jest.spyOn(logger, "log").mockClear();

            jest.spyOn(MatrixJs, "createClient").mockReturnValue(mockClient);

            // stub this out
            jest.spyOn(Modal, "createDialog").mockReturnValue(
                // @ts-ignore allow bad mock
                { finished: Promise.resolve([true]) },
            );
        });

        it("should return false when localStorage is not available", async () => {
            // @ts-ignore dirty mocking
            delete global.localStorage;
            // @ts-ignore dirty mocking
            global.localStorage = undefined;

            expect(await restoreSessionFromStorage()).toEqual(false);
        });

        it("should return false when no session data is found in local storage", async () => {
            expect(await restoreSessionFromStorage()).toEqual(false);
            expect(logger.log).toHaveBeenCalledWith("No previous session found.");
        });

        it("should abort login when we expect to find an access token but don't", async () => {
            initLocalStorageMock({ mx_has_access_token: "true" });

            await expect(() => restoreSessionFromStorage()).rejects.toThrow();
            expect(Modal.createDialog).toHaveBeenCalledWith(StorageEvictedDialog);
            expect(mockClient.clearStores).toHaveBeenCalled();
        });

        describe("when session is found in storage", () => {
            describe("guest account", () => {
                beforeEach(() => {
                    initLocalStorageMock({ ...localStorageSession, mx_is_guest: "true" });
                    initIdbMock(idbStorageSession);
                });

                it("should ignore guest accounts when ignoreGuest is true", async () => {
                    expect(await restoreSessionFromStorage({ ignoreGuest: true })).toEqual(false);
                    expect(logger.log).toHaveBeenCalledWith(`Ignoring stored guest account: ${userId}`);
                });

                it("should restore guest accounts when ignoreGuest is false", async () => {
                    expect(await restoreSessionFromStorage({ ignoreGuest: false })).toEqual(true);

                    expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
                        expect.objectContaining({
                            userId,
                            guest: true,
                        }),
                        undefined,
                    );
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_is_guest", "true");
                });
            });

            describe("without a pickle key", () => {
                beforeEach(() => {
                    initLocalStorageMock(localStorageSession);
                    initIdbMock(idbStorageSession);
                });

                it("should persist credentials", async () => {
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_user_id", userId);
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_access_token", "true");
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_is_guest", "false");
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_device_id", deviceId);

                    expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                    // dont put accessToken in localstorage when we have idb
                    expect(localStorage.setItem).not.toHaveBeenCalledWith("mx_access_token", accessToken);
                });

                it("should persist access token when idb is not available", async () => {
                    jest.spyOn(StorageAccess, "idbSave").mockRejectedValue("oups");
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                    // put accessToken in localstorage as fallback
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_access_token", accessToken);
                });

                it("should create and start new matrix client with credentials", async () => {
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
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

                    expect(sessionStorage.removeItem).toHaveBeenCalledWith("mx_fresh_login");
                });

                it("should start matrix client", async () => {
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(MatrixClientPeg.start).toHaveBeenCalled();
                });

                describe("with a refresh token", () => {
                    beforeEach(() => {
                        initLocalStorageMock({
                            ...localStorageSession,
                            mx_refresh_token: refreshToken,
                        });
                        initIdbMock(idbStorageSession);
                    });

                    it("should persist credentials", async () => {
                        expect(await restoreSessionFromStorage()).toEqual(true);

                        // refresh token from storage is re-persisted
                        expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_refresh_token", "true");
                        expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_refresh_token", refreshToken);
                    });

                    it("should create new matrix client with credentials", async () => {
                        expect(await restoreSessionFromStorage()).toEqual(true);

                        expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
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
                            undefined,
                        );
                    });
                });
            });

            describe("with a normal pickle key", () => {
                let pickleKey: string;

                beforeEach(async () => {
                    initLocalStorageMock(localStorageSession);
                    initIdbMock({});

                    // Create a pickle key, and store it, encrypted, in IDB.
                    pickleKey = (await PlatformPeg.get()!.createPickleKey(credentials.userId, credentials.deviceId))!;

                    // Indicate that we should have a pickle key
                    localStorage.setItem("mx_has_pickle_key", "true");

                    await persistAccessTokenInStorage(credentials.accessToken, pickleKey);
                });

                it("should persist credentials", async () => {
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_access_token", "true");

                    // token encrypted and persisted
                    expect(StorageAccess.idbSave).toHaveBeenCalledWith(
                        "account",
                        "mx_access_token",
                        encryptedTokenShapedObject,
                    );
                });

                it("should persist access token when idb is not available", async () => {
                    // dont fail for pickle key persist
                    jest.spyOn(StorageAccess, "idbSave").mockImplementation(
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
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_access_token", accessToken);
                });

                it("should create and start new matrix client with credentials", async () => {
                    // Check that the rust crypto key is as expected. We have to do this during the call, as
                    // the buffer is cleared afterwards.
                    mocked(MatrixClientPeg.start).mockImplementation(async (opts) => {
                        expect(opts?.rustCryptoStoreKey).toEqual(decodeBase64(pickleKey));
                    });

                    // Perform the restore
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    // Ensure that the expected calls were made
                    expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
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

                    expect(MatrixClientPeg.start).toHaveBeenCalledWith({ rustCryptoStoreKey: expect.any(Uint8Array) });
                });

                describe("with a refresh token", () => {
                    beforeEach(async () => {
                        await persistRefreshTokenInStorage(refreshToken, pickleKey);
                    });

                    it("should persist credentials", async () => {
                        expect(await restoreSessionFromStorage()).toEqual(true);

                        // refresh token from storage is re-persisted
                        expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_refresh_token", "true");
                        expect(StorageAccess.idbSave).toHaveBeenCalledWith(
                            "account",
                            "mx_refresh_token",
                            encryptedTokenShapedObject,
                        );
                    });

                    it("should create new matrix client with credentials", async () => {
                        expect(await restoreSessionFromStorage()).toEqual(true);

                        expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
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
                            undefined,
                        );
                    });
                });
            });

            describe("with a non-standard pickle key", () => {
                // Most pickle keys are 43 bytes of base64. Test what happens when it is something else.
                let pickleKey: string;

                beforeEach(async () => {
                    initLocalStorageMock(localStorageSession);
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

                    await persistAccessTokenInStorage(credentials.accessToken, pickleKey);
                });

                it("should create and start new matrix client with credentials", async () => {
                    // Perform the restore
                    expect(await restoreSessionFromStorage()).toEqual(true);

                    // Ensure that the expected calls were made
                    expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
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
                initLocalStorageMock(localStorageSession);
                initIdbMock(idbStorageSession);
                mockClient.isVersionSupported.mockRejectedValue(new Error("Oh, noes, the server is down!"));

                expect(await restoreSessionFromStorage()).toEqual(true);
            });

            it("should throw if the token was persisted with a pickle key but there is no pickle key available now", async () => {
                initLocalStorageMock(localStorageSession);
                initIdbMock({});

                // Create a pickle key, and store it, encrypted, in IDB.
                const pickleKey = (await PlatformPeg.get()!.createPickleKey(credentials.userId, credentials.deviceId))!;
                localStorage.setItem("mx_has_pickle_key", "true");
                await persistAccessTokenInStorage(credentials.accessToken, pickleKey);

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
            initLocalStorageMock();
            initSessionStorageMock();
            initIdbMock();

            jest.clearAllMocks();
            jest.spyOn(logger, "log").mockClear();

            jest.spyOn(MatrixJs, "createClient").mockReturnValue(mockClient);
            // remove any mock implementations
            jest.spyOn(mockPlatform, "createPickleKey").mockRestore();
            // but still spy and call through
            jest.spyOn(mockPlatform, "createPickleKey");
        });

        const refreshToken = "test-refresh-token";

        it("should remove fresh login flag from session storage", async () => {
            await setLoggedIn(credentials);

            expect(sessionStorage.removeItem).toHaveBeenCalledWith("mx_fresh_login");
        });

        it("should start matrix client", async () => {
            await setLoggedIn(credentials);

            expect(MatrixClientPeg.start).toHaveBeenCalled();
        });

        describe("without a pickle key", () => {
            beforeEach(() => {
                jest.spyOn(mockPlatform, "createPickleKey").mockResolvedValue(null);
            });

            it("should persist credentials", async () => {
                await setLoggedIn(credentials);

                expect(localStorage.setItem).toHaveBeenCalledWith("mx_user_id", userId);
                expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_access_token", "true");
                expect(localStorage.setItem).toHaveBeenCalledWith("mx_is_guest", "false");
                expect(localStorage.setItem).toHaveBeenCalledWith("mx_device_id", deviceId);

                expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                // dont put accessToken in localstorage when we have idb
                expect(localStorage.setItem).not.toHaveBeenCalledWith("mx_access_token", accessToken);
            });

            it("should persist a refreshToken when present", async () => {
                await setLoggedIn({
                    ...credentials,
                    refreshToken,
                });

                expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_refresh_token", refreshToken);
                // dont put accessToken in localstorage when we have idb
                expect(localStorage.setItem).not.toHaveBeenCalledWith("mx_access_token", accessToken);
            });

            it("should remove any access token from storage when there is none in credentials and idb save fails", async () => {
                jest.spyOn(StorageAccess, "idbSave").mockRejectedValue("oups");
                await setLoggedIn({
                    ...credentials,
                    // @ts-ignore
                    accessToken: undefined,
                });

                expect(localStorage.removeItem).toHaveBeenCalledWith("mx_has_access_token");
                expect(localStorage.removeItem).toHaveBeenCalledWith("mx_access_token");
            });

            it("should clear stores", async () => {
                await setLoggedIn(credentials);

                expect(StorageAccess.idbClear).toHaveBeenCalledWith("account");
                expect(sessionStorage.clear).toHaveBeenCalled();
                expect(mockClient.clearStores).toHaveBeenCalled();
            });

            it("should create new matrix client with credentials", async () => {
                expect(await setLoggedIn(credentials)).toEqual(mockClient);

                expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
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

                expect(localStorage.setItem).toHaveBeenCalledWith("mx_user_id", userId);
                expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_access_token", "true");
                expect(localStorage.setItem).toHaveBeenCalledWith("mx_is_guest", "false");
                expect(localStorage.setItem).toHaveBeenCalledWith("mx_device_id", deviceId);

                expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_pickle_key", "true");
                expect(StorageAccess.idbSave).toHaveBeenCalledWith(
                    "account",
                    "mx_access_token",
                    encryptedTokenShapedObject,
                );
                expect(StorageAccess.idbSave).toHaveBeenCalledWith("pickleKey", [userId, deviceId], expect.any(Object));
                // dont put accessToken in localstorage when we have idb
                expect(localStorage.setItem).not.toHaveBeenCalledWith("mx_access_token", accessToken);
            });

            it("should persist token when encrypting the token fails", async () => {
                jest.spyOn(encryptAESSecretStorageItemModule, "default").mockRejectedValue("MOCK REJECT ENCRYPTAES");
                await setLoggedIn(credentials);

                // persist the unencrypted token
                expect(StorageAccess.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
            });

            it("should persist token in localStorage when idb fails to save token", async () => {
                // dont fail for pickle key persist
                jest.spyOn(StorageAccess, "idbSave").mockImplementation(
                    async (table: string, key: string | string[]) => {
                        if (table === "account" && key === "mx_access_token") {
                            throw new Error("oups");
                        }
                    },
                );
                await setLoggedIn(credentials);

                // put plain accessToken in localstorage when we dont have idb
                expect(localStorage.setItem).toHaveBeenCalledWith("mx_access_token", accessToken);
            });

            it("should remove any access token from storage when there is none in credentials and idb save fails", async () => {
                // dont fail for pickle key persist
                jest.spyOn(StorageAccess, "idbSave").mockImplementation(
                    async (table: string, key: string | string[]) => {
                        if (table === "account" && key === "mx_access_token") {
                            throw new Error("oups");
                        }
                    },
                );
                await setLoggedIn({
                    ...credentials,
                    // @ts-ignore
                    accessToken: undefined,
                });

                expect(localStorage.removeItem).toHaveBeenCalledWith("mx_has_access_token");
                expect(localStorage.removeItem).toHaveBeenCalledWith("mx_access_token");
            });

            it("should create new matrix client with credentials", async () => {
                expect(await setLoggedIn(credentials)).toEqual(mockClient);

                expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
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

        describe("when authenticated via OIDC native flow", () => {
            const clientId = "test-client-id";
            const issuer = "https://auth.com/";

            const delegatedAuthConfig = makeDelegatedAuthConfig(issuer);
            const idToken =
                "eyJhbGciOiJSUzI1NiIsImtpZCI6Imh4ZEhXb0Y5bW4ifQ.eyJzdWIiOiIwMUhQUDJGU0JZREU5UDlFTU04REQ3V1pIUiIsImlzcyI6Imh0dHBzOi8vYXV0aC1vaWRjLmxhYi5lbGVtZW50LmRldi8iLCJpYXQiOjE3MTUwNzE5ODUsImF1dGhfdGltZSI6MTcwNzk5MDMxMiwiY19oYXNoIjoidGt5R1RhUjU5aTk3YXoyTU4yMGdidyIsImV4cCI6MTcxNTA3NTU4NSwibm9uY2UiOiJxaXhwM0hFMmVaIiwiYXVkIjoiMDFIWDk0Mlg3QTg3REgxRUs2UDRaNjI4WEciLCJhdF9oYXNoIjoiNFlFUjdPRlVKTmRTeEVHV2hJUDlnZyJ9.HxODneXvSTfWB5Vc4cf7b8GiN2gdwUuTiyVqZuupWske2HkZiJZUt5Lsxg9BW3gz28POkE0Ln17snlkmy02B_AD3DQxKOOxQCzIIARHdfFvZxgGWsMdFcVQZDW7rtXcqgj-SpVaUQ_8acsgxSrz_DF2o0O4tto0PT6wVUiw8KlBmgWTscWPeAWe-39T-8EiQ8Wi16h6oSPcz2NzOQ7eOM_S9fDkOorgcBkRGLl1nrahrPSdWJSGAeruk5mX4YxN714YThFDyEA2t9YmKpjaiSQ2tT-Xkd7tgsZqeirNs2ni9mIiFX3bRX6t2AhUNzA7MaX9ZyizKGa6go3BESO_oDg";

            beforeAll(() => {
                fetchMock.get(`${delegatedAuthConfig.issuer}.well-known/openid-configuration`, delegatedAuthConfig);
                fetchMock.get(`${delegatedAuthConfig.issuer}jwks`, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    keys: [],
                });
            });

            beforeEach(() => {
                initSessionStorageMock();
                // set values in session storage as they would be after a successful oidc authentication
                persistOidcAuthenticatedSettings(clientId, issuer, idToken);
            });

            it("should not try to create a token refresher without a refresh token", async () => {
                await setLoggedIn(credentials);

                // didn't try to initialise token refresher
                expect(fetchMock).not.toHaveFetched(`${delegatedAuthConfig.issuer}.well-known/openid-configuration`);
            });

            it("should not try to create a token refresher without a deviceId", async () => {
                await setLoggedIn({
                    ...credentials,
                    refreshToken,
                    deviceId: undefined,
                });

                // didn't try to initialise token refresher
                expect(fetchMock).not.toHaveFetched(`${delegatedAuthConfig.issuer}.well-known/openid-configuration`);
            });

            it("should not try to create a token refresher without an issuer in session storage", async () => {
                persistOidcAuthenticatedSettings(
                    clientId,
                    // @ts-ignore set undefined issuer
                    undefined,
                    idToken,
                );
                await setLoggedIn({
                    ...credentials,
                    refreshToken,
                });

                // didn't try to initialise token refresher
                expect(fetchMock).not.toHaveFetched(`${delegatedAuthConfig.issuer}.well-known/openid-configuration`);
            });

            it("should create a client with a tokenRefreshFunction", async () => {
                expect(
                    await setLoggedIn({
                        ...credentials,
                        refreshToken,
                    }),
                ).toEqual(mockClient);

                expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
                    expect.objectContaining({
                        accessToken,
                        refreshToken,
                    }),
                    expect.any(Function),
                );
            });

            it("should create a client when creating token refresher fails", async () => {
                // set invalid value in session storage for a malformed oidc authentication
                persistOidcAuthenticatedSettings(null as any, issuer, idToken);

                // succeeded
                expect(
                    await setLoggedIn({
                        ...credentials,
                        refreshToken,
                    }),
                ).toEqual(mockClient);

                expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
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
        let oidcClientStore!: OidcClientStore;
        const accessToken = "test-access-token";
        const refreshToken = "test-refresh-token";

        beforeEach(() => {
            oidcClientStore = new OidcClientStore(mockClient);
            // stub
            jest.spyOn(oidcClientStore, "revokeTokens").mockResolvedValue(undefined);

            mockClient.getAccessToken.mockReturnValue(accessToken);
            mockClient.getRefreshToken.mockReturnValue(refreshToken);
        });

        it("should call logout on the client when oidcClientStore is falsy", async () => {
            logout();

            await flushPromises();

            expect(mockClient.logout).toHaveBeenCalledWith(true);
        });

        it("should call logout on the client when oidcClientStore.isUserAuthenticatedWithOidc is falsy", async () => {
            jest.spyOn(oidcClientStore, "isUserAuthenticatedWithOidc", "get").mockReturnValue(false);
            logout(oidcClientStore);

            await flushPromises();

            expect(mockClient.logout).toHaveBeenCalledWith(true);
            expect(oidcClientStore.revokeTokens).not.toHaveBeenCalled();
        });

        it("should revoke tokens when user is authenticated with oidc", async () => {
            jest.spyOn(oidcClientStore, "isUserAuthenticatedWithOidc", "get").mockReturnValue(true);
            logout(oidcClientStore);

            await flushPromises();

            expect(mockClient.logout).not.toHaveBeenCalled();
            expect(oidcClientStore.revokeTokens).toHaveBeenCalledWith(accessToken, refreshToken);
        });
    });

    describe("overwritelogin", () => {
        beforeEach(async () => {
            jest.spyOn(MatrixJs, "createClient").mockReturnValue(mockClient);
        });

        it("should replace the current login with a new one", async () => {
            const stopSpy = jest.spyOn(mockClient, "stopClient").mockReturnValue(undefined);
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
            jest.spyOn(MatrixClientPeg, "unset").mockReturnValue(undefined);

            expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
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

            expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: otherCredentials.userId,
                }),
                undefined,
            );

            expect(MatrixClientPeg.unset).not.toHaveBeenCalled();
        });
    });
});
