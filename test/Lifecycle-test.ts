/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { Crypto } from "@peculiar/webcrypto";
import { logger } from "matrix-js-sdk/src/logger";
import * as MatrixJs from "matrix-js-sdk/src/matrix";
import { setCrypto } from "matrix-js-sdk/src/crypto/crypto";
import * as MatrixCryptoAes from "matrix-js-sdk/src/crypto/aes";
import { MockedObject } from "jest-mock";
import fetchMock from "fetch-mock-jest";

import StorageEvictedDialog from "../src/components/views/dialogs/StorageEvictedDialog";
import { logout, restoreFromLocalStorage, setLoggedIn } from "../src/Lifecycle";
import { MatrixClientPeg } from "../src/MatrixClientPeg";
import Modal from "../src/Modal";
import * as StorageManager from "../src/utils/StorageManager";
import { flushPromises, getMockClientWithEventEmitter, mockClientMethodsUser, mockPlatformPeg } from "./test-utils";
import ToastStore from "../src/stores/ToastStore";
import { OidcClientStore } from "../src/stores/oidc/OidcClientStore";
import { makeDelegatedAuthConfig } from "./test-utils/oidc";
import { persistOidcAuthenticatedSettings } from "../src/utils/oidc/persistOidcSettings";
import { Action } from "../src/dispatcher/actions";

const webCrypto = new Crypto();

const windowCrypto = window.crypto;

describe("Lifecycle", () => {
    const mockPlatform = mockPlatformPeg();

    const realLocalStorage = global.localStorage;

    let mockClient!: MockedObject<MatrixJs.MatrixClient>;

    beforeEach(() => {
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

        setCrypto(webCrypto);
        // @ts-ignore mocking
        delete window.crypto;
        window.crypto = webCrypto;

        jest.spyOn(MatrixCryptoAes, "encryptAES").mockRestore();
    });

    afterAll(() => {
        setCrypto(windowCrypto);

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
        jest.spyOn(StorageManager, "idbLoad")
            .mockClear()
            .mockImplementation(
                // @ts-ignore mock type
                async (table: string, key: string) => mockStore[table]?.[key] ?? null,
            );
        jest.spyOn(StorageManager, "idbSave")
            .mockClear()
            .mockImplementation(
                // @ts-ignore mock type
                async (tableKey: string, key: string, value: unknown) => {
                    const table = mockStore[tableKey] || {};
                    table[key as string] = value;
                    mockStore[tableKey] = table;
                },
            );
        jest.spyOn(StorageManager, "idbDelete").mockClear().mockResolvedValue(undefined);
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

    describe("restoreFromLocalStorage()", () => {
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

            expect(await restoreFromLocalStorage()).toEqual(false);
        });

        it("should return false when no session data is found in local storage", async () => {
            expect(await restoreFromLocalStorage()).toEqual(false);
            expect(logger.log).toHaveBeenCalledWith("No previous session found.");
        });

        it("should abort login when we expect to find an access token but don't", async () => {
            initLocalStorageMock({ mx_has_access_token: "true" });

            await expect(() => restoreFromLocalStorage()).rejects.toThrow();
            expect(Modal.createDialog).toHaveBeenCalledWith(StorageEvictedDialog);
            expect(mockClient.clearStores).toHaveBeenCalled();
        });

        describe("when session is found in storage", () => {
            beforeEach(() => {
                initLocalStorageMock(localStorageSession);
                initIdbMock(idbStorageSession);
            });

            describe("guest account", () => {
                it("should ignore guest accounts when ignoreGuest is true", async () => {
                    initLocalStorageMock({ ...localStorageSession, mx_is_guest: "true" });

                    expect(await restoreFromLocalStorage({ ignoreGuest: true })).toEqual(false);
                    expect(logger.log).toHaveBeenCalledWith(`Ignoring stored guest account: ${userId}`);
                });

                it("should restore guest accounts when ignoreGuest is false", async () => {
                    initLocalStorageMock({ ...localStorageSession, mx_is_guest: "true" });

                    expect(await restoreFromLocalStorage({ ignoreGuest: false })).toEqual(true);

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
                it("should persist credentials", async () => {
                    expect(await restoreFromLocalStorage()).toEqual(true);

                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_user_id", userId);
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_access_token", "true");
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_is_guest", "false");
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_device_id", deviceId);

                    expect(StorageManager.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                    // dont put accessToken in localstorage when we have idb
                    expect(localStorage.setItem).not.toHaveBeenCalledWith("mx_access_token", accessToken);
                });

                it("should persist access token when idb is not available", async () => {
                    jest.spyOn(StorageManager, "idbSave").mockRejectedValue("oups");
                    expect(await restoreFromLocalStorage()).toEqual(true);

                    expect(StorageManager.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                    // put accessToken in localstorage as fallback
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_access_token", accessToken);
                });

                it("should create new matrix client with credentials", async () => {
                    expect(await restoreFromLocalStorage()).toEqual(true);

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
                });

                it("should remove fresh login flag from session storage", async () => {
                    expect(await restoreFromLocalStorage()).toEqual(true);

                    expect(sessionStorage.removeItem).toHaveBeenCalledWith("mx_fresh_login");
                });

                it("should start matrix client", async () => {
                    expect(await restoreFromLocalStorage()).toEqual(true);

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
                        expect(await restoreFromLocalStorage()).toEqual(true);

                        // refresh token from storage is re-persisted
                        expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_refresh_token", "true");
                        expect(StorageManager.idbSave).toHaveBeenCalledWith(
                            "account",
                            "mx_refresh_token",
                            refreshToken,
                        );
                    });

                    it("should create new matrix client with credentials", async () => {
                        expect(await restoreFromLocalStorage()).toEqual(true);

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

            describe("with a pickle key", () => {
                beforeEach(async () => {
                    initLocalStorageMock({});
                    initIdbMock({});
                    // setup storage with a session with encrypted token
                    await setLoggedIn(credentials);
                });

                it("should persist credentials", async () => {
                    expect(await restoreFromLocalStorage()).toEqual(true);

                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_access_token", "true");

                    // token encrypted and persisted
                    expect(StorageManager.idbSave).toHaveBeenCalledWith(
                        "account",
                        "mx_access_token",
                        encryptedTokenShapedObject,
                    );
                });

                it("should persist access token when idb is not available", async () => {
                    // dont fail for pickle key persist
                    jest.spyOn(StorageManager, "idbSave").mockImplementation(
                        async (table: string, key: string | string[]) => {
                            if (table === "account" && key === "mx_access_token") {
                                throw new Error("oups");
                            }
                        },
                    );

                    expect(await restoreFromLocalStorage()).toEqual(true);

                    expect(StorageManager.idbSave).toHaveBeenCalledWith(
                        "account",
                        "mx_access_token",
                        encryptedTokenShapedObject,
                    );
                    // put accessToken in localstorage as fallback
                    expect(localStorage.setItem).toHaveBeenCalledWith("mx_access_token", accessToken);
                });

                it("should create new matrix client with credentials", async () => {
                    expect(await restoreFromLocalStorage()).toEqual(true);

                    expect(MatrixClientPeg.replaceUsingCreds).toHaveBeenCalledWith(
                        {
                            userId,
                            // decrypted accessToken
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

                describe("with a refresh token", () => {
                    beforeEach(async () => {
                        initLocalStorageMock({});
                        initIdbMock({});
                        // setup storage with a session with encrypted token
                        await setLoggedIn({
                            ...credentials,
                            refreshToken,
                        });
                    });

                    it("should persist credentials", async () => {
                        expect(await restoreFromLocalStorage()).toEqual(true);

                        // refresh token from storage is re-persisted
                        expect(localStorage.setItem).toHaveBeenCalledWith("mx_has_refresh_token", "true");
                        expect(StorageManager.idbSave).toHaveBeenCalledWith(
                            "account",
                            "mx_refresh_token",
                            encryptedTokenShapedObject,
                        );
                    });

                    it("should create new matrix client with credentials", async () => {
                        expect(await restoreFromLocalStorage()).toEqual(true);

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
                                pickleKey: expect.any(String),
                            },
                            undefined,
                        );
                    });
                });
            });

            it("should show a toast if the matrix server version is unsupported", async () => {
                const toastSpy = jest.spyOn(ToastStore.sharedInstance(), "addOrReplaceToast");
                mockClient.isVersionSupported.mockImplementation(async (version) => version == "r0.6.0");
                initLocalStorageMock({ ...localStorageSession });

                expect(await restoreFromLocalStorage()).toEqual(true);
                expect(toastSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: "Your server is unsupported",
                    }),
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

                expect(StorageManager.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                // dont put accessToken in localstorage when we have idb
                expect(localStorage.setItem).not.toHaveBeenCalledWith("mx_access_token", accessToken);
            });

            it("should persist a refreshToken when present", async () => {
                await setLoggedIn({
                    ...credentials,
                    refreshToken,
                });

                expect(StorageManager.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
                expect(StorageManager.idbSave).toHaveBeenCalledWith("account", "mx_refresh_token", refreshToken);
                // dont put accessToken in localstorage when we have idb
                expect(localStorage.setItem).not.toHaveBeenCalledWith("mx_access_token", accessToken);
            });

            it("should remove any access token from storage when there is none in credentials and idb save fails", async () => {
                jest.spyOn(StorageManager, "idbSave").mockRejectedValue("oups");
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

                expect(StorageManager.idbDelete).toHaveBeenCalledWith("account", "mx_access_token");
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
                        pickleKey: null,
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
                expect(StorageManager.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
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
                expect(StorageManager.idbSave).toHaveBeenCalledWith(
                    "account",
                    "mx_access_token",
                    encryptedTokenShapedObject,
                );
                expect(StorageManager.idbSave).toHaveBeenCalledWith(
                    "pickleKey",
                    [userId, deviceId],
                    expect.any(Object),
                );
                // dont put accessToken in localstorage when we have idb
                expect(localStorage.setItem).not.toHaveBeenCalledWith("mx_access_token", accessToken);
            });

            it("should persist token when encrypting the token fails", async () => {
                jest.spyOn(MatrixCryptoAes, "encryptAES").mockRejectedValue("MOCK REJECT ENCRYPTAES");
                await setLoggedIn(credentials);

                // persist the unencrypted token
                expect(StorageManager.idbSave).toHaveBeenCalledWith("account", "mx_access_token", accessToken);
            });

            it("should persist token in localStorage when idb fails to save token", async () => {
                // dont fail for pickle key persist
                jest.spyOn(StorageManager, "idbSave").mockImplementation(
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
                jest.spyOn(StorageManager, "idbSave").mockImplementation(
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
            const idTokenClaims = {
                aud: "123",
                iss: issuer,
                sub: "123",
                exp: 123,
                iat: 456,
            };

            beforeAll(() => {
                fetchMock.get(
                    `${delegatedAuthConfig.metadata.issuer}.well-known/openid-configuration`,
                    delegatedAuthConfig.metadata,
                );
                fetchMock.get(`${delegatedAuthConfig.metadata.issuer}jwks`, {
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
                persistOidcAuthenticatedSettings(clientId, issuer, idTokenClaims);
            });

            it("should not try to create a token refresher without a refresh token", async () => {
                await setLoggedIn(credentials);

                // didn't try to initialise token refresher
                expect(fetchMock).not.toHaveFetched(
                    `${delegatedAuthConfig.metadata.issuer}.well-known/openid-configuration`,
                );
            });

            it("should not try to create a token refresher without a deviceId", async () => {
                await setLoggedIn({
                    ...credentials,
                    refreshToken,
                    deviceId: undefined,
                });

                // didn't try to initialise token refresher
                expect(fetchMock).not.toHaveFetched(
                    `${delegatedAuthConfig.metadata.issuer}.well-known/openid-configuration`,
                );
            });

            it("should not try to create a token refresher without an issuer in session storage", async () => {
                persistOidcAuthenticatedSettings(
                    clientId,
                    // @ts-ignore set undefined issuer
                    undefined,
                    idTokenClaims,
                );
                await setLoggedIn({
                    ...credentials,
                    refreshToken,
                });

                // didn't try to initialise token refresher
                expect(fetchMock).not.toHaveFetched(
                    `${delegatedAuthConfig.metadata.issuer}.well-known/openid-configuration`,
                );
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
                persistOidcAuthenticatedSettings(null as any, issuer, idTokenClaims);

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
