/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Mocked, mocked } from "jest-mock";
import {
    type HttpApiEvent,
    type HttpApiEventHandlerMap,
    type IHttpOpts,
    type MatrixClient,
    TypedEventEmitter,
    MatrixHttpApi,
} from "matrix-js-sdk/src/matrix";
import fetchMock from "fetch-mock-jest";

import { getMockClientWithEventEmitter, mockClientMethodsCrypto, mockPlatformPeg } from "../test-utils";
import { collectBugReport } from "../../src/rageshake/submit-rageshake";
import SettingsStore from "../../src/settings/SettingsStore";
import { type ConsoleLogger } from "../../src/rageshake/rageshake";
import { type FeatureSettingKey, type SettingKey } from "../../src/settings/Settings.tsx";

describe("Rageshakes", () => {
    const RUST_CRYPTO_VERSION = "Rust SDK 0.7.0 (691ec63), Vodozemac 0.5.0";
    const OLM_CRYPTO_VERSION = "Olm 3.2.15";
    let mockClient: Mocked<MatrixClient>;
    const mockHttpAPI: MatrixHttpApi<IHttpOpts & { onlyData: true }> = new MatrixHttpApi(
        new TypedEventEmitter<HttpApiEvent, HttpApiEventHandlerMap>(),
        {
            baseUrl: "https://alice-server.com",
            prefix: "/_matrix/client/v3",
            onlyData: true,
        },
    );

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            credentials: { userId: "@test:example.com" },
            deviceId: "AAAAAAAAAA",
            baseUrl: "https://alice-server.com",
            getHomeserverUrl: jest.fn().mockReturnValue("https://alice-server.com"),
            getDomain: jest.fn().mockReturnValue("alice-server.com"),
            ...mockClientMethodsCrypto(),
            http: mockHttpAPI,
        });
        mocked(mockClient.getCrypto()!.getOwnDeviceKeys).mockResolvedValue({
            ed25519: "",
            curve25519: "",
        });

        fetchMock.restore();
        fetchMock.catch(404);
    });

    describe("Basic Information", () => {
        let mockWindow: Mocked<Window>;
        let windowSpy: jest.SpyInstance;

        beforeEach(() => {
            mockWindow = {
                matchMedia: jest.fn().mockReturnValue({ matches: false }),
                navigator: {
                    userAgent: "",
                },
            } as unknown as Mocked<Window>;
            // @ts-ignore - We just need partial mock
            windowSpy = jest.spyOn(global, "window", "get").mockReturnValue(mockWindow);
        });

        afterEach(() => {
            windowSpy.mockRestore();
        });

        it("should include app version", async () => {
            mockPlatformPeg({ getAppVersion: jest.fn().mockReturnValue("1.11.58") });

            const formData = await collectBugReport();

            const appVersion = formData.get("version");

            expect(appVersion).toBe("1.11.58");
        });

        it("should put unknown app version if on dev", async () => {
            mockPlatformPeg({ getAppVersion: jest.fn().mockRejectedValue(undefined) });

            const formData = await collectBugReport();

            const appVersion = formData.get("version");

            expect(appVersion).toBe("UNKNOWN");
        });

        const mediaQueryTests: Array<[string, string, string, boolean]> = [
            ["if installed WPA", "(display-mode: standalone)", "installed_pwa", true],
            ["if not installed WPA", "(display-mode: standalone)", "installed_pwa", false],
            ["if touchInput", "(pointer: coarse)", "touch_input", true],
            ["if not touchInput", "(pointer: coarse)", "touch_input", false],
        ];

        it.each(mediaQueryTests)("should collect %s", async (_, query, label, matches) => {
            mocked(mockWindow.matchMedia).mockImplementation((q): MediaQueryList => {
                if (q === query) {
                    return { matches: matches } as unknown as MediaQueryList;
                }
                return { matches: false } as unknown as MediaQueryList;
            });

            const formData = await collectBugReport();

            const value = formData.get(label);
            expect(value).toBe(String(matches));
        });

        const optionsTests: Array<[string, string, string, string]> = [
            // [name, opt name, label, default]
            ["userText", "userText", "text", "User did not supply any additional text."],
            ["customApp", "customApp", "app", "element-web"],
        ];

        it.each(optionsTests)("should collect %s", async (_, optName, label, defaultValue) => {
            const formData = await collectBugReport();

            const value = formData.get(label);
            expect(value).toBe(defaultValue);

            const formDataWithOpt = await collectBugReport({ [optName]: "SomethingSomething" });
            expect(formDataWithOpt.get(label)).toBe("SomethingSomething");
        });

        it("should collect custom fields", async () => {
            const formDataWithOpt = await collectBugReport({
                customFields: {
                    something: "SomethingSomething",
                    another: "AnotherThing",
                },
            });

            expect(formDataWithOpt.get("something")).toBe("SomethingSomething");
            expect(formDataWithOpt.get("another")).toBe("AnotherThing");
        });

        it("should collect user agent", async () => {
            jest.replaceProperty(mockWindow.navigator, "userAgent", "jest navigator");
            const formData = await collectBugReport();
            const userAgent = formData.get("user_agent");
            expect(userAgent).toBe("jest navigator");

            // @ts-ignore - Need to force navigator to be undefined for test
            jest.replaceProperty(mockWindow, "navigator", undefined);
            const formDataWithoutNav = await collectBugReport();
            expect(formDataWithoutNav.get("user_agent")).toBe("UNKNOWN");
        });
    });

    describe("Credentials", () => {
        it("should collect user id", async () => {
            const formData = await collectBugReport();
            expect(formData.get("user_id")).toBe("@test:example.com");
        });

        it("should collect device id", async () => {
            const formData = await collectBugReport();

            expect(formData.get("device_id")).toBe("AAAAAAAAAA");
        });
    });

    describe("Crypto info", () => {
        it("should collect crypto version", async () => {
            mocked(mockClient.getCrypto()!.getVersion).mockReturnValue("0.0.0");
            const formData = await collectBugReport();

            expect(formData.get("crypto_version")).toBe("0.0.0");
        });

        it("should collect device keys", async () => {
            const ownDeviceKeys = {
                curve25519: "curve25519b64",
                ed25519: "ed25519b64",
            };

            mocked(mockClient.getCrypto()!.getOwnDeviceKeys).mockResolvedValue(ownDeviceKeys);

            const keys = [`curve25519:${ownDeviceKeys.curve25519}`, `ed25519:${ownDeviceKeys.ed25519}`].join(", ");

            const formData = await collectBugReport();

            expect(formData.get("device_keys")).toBe(keys);
        });

        describe("Cross-Signing", () => {
            it.each([true, false])("should collect cross-signing ready %s", async (ready) => {
                mocked(mockClient.getCrypto()!.isCrossSigningReady).mockResolvedValue(ready);

                const formData = await collectBugReport();

                expect(formData.get("cross_signing_ready")).toBe(String(ready));
            });

            it("should collect cross-signing pub key if set", async () => {
                const crossSigningPubKey = "crossSigningPubKey";
                mocked(mockClient.getCrypto()!.getCrossSigningKeyId).mockImplementation(
                    async (type): Promise<string | null> => {
                        if (!type || type === "master") {
                            return crossSigningPubKey;
                        }
                        return null;
                    },
                );

                const formData = await collectBugReport();

                expect(formData.get("cross_signing_key")).toBe(crossSigningPubKey);
            });

            it("should not collect cross-signing pub key if not set", async () => {
                mocked(mockClient.getCrypto()!.getCrossSigningKeyId).mockResolvedValue(null);
                expect((await collectBugReport()).get("cross_signing_key")).toBe("n/a");
            });

            describe("Cross-signing status", () => {
                const baseDetails = {
                    masterKey: false,
                    selfSigningKey: false,
                    userSigningKey: false,
                };
                const baseStatus = {
                    privateKeysInSecretStorage: false,
                    publicKeysOnDevice: false,
                    privateKeysCachedLocally: {
                        ...baseDetails,
                    },
                };

                it.each([true, false])("should collect if key cached locally %s", async (cached) => {
                    mocked(mockClient.getCrypto()!.getCrossSigningStatus).mockResolvedValue({
                        ...baseStatus,
                        privateKeysInSecretStorage: cached,
                    });

                    const formData = await collectBugReport();

                    expect(formData.get("cross_signing_privkey_in_secret_storage")).toBe(String(cached));
                });

                // @ts-ignore
                const detailsTests: Array<[string, string, string]> = [
                    ["master", "masterKey", "cross_signing_master_privkey_cached"],
                    ["ssk", "selfSigningKey", "cross_signing_self_signing_privkey_cached"],
                    ["usk", "userSigningKey", "cross_signing_user_signing_privkey_cached"],
                ];
                describe.each(detailsTests)("Cached locally %s", (_, objectKey, label) => {
                    it.each([true, false])("should collect if cached locally %s", async (cached) => {
                        mocked(mockClient.getCrypto()!.getCrossSigningStatus).mockResolvedValue({
                            ...baseStatus,
                            privateKeysCachedLocally: {
                                ...baseDetails,
                                [objectKey]: cached,
                            },
                        });

                        const formData = await collectBugReport();

                        expect(formData.get(label)).toBe(String(cached));
                    });
                });
            });

            describe("Secret Storage and backup", () => {
                it.each([true, false])("should collect secret storage ready %s", async (ready) => {
                    mocked(mockClient.getCrypto()!.isSecretStorageReady).mockResolvedValue(ready);

                    const formData = await collectBugReport();

                    expect(formData.get("secret_storage_ready")).toBe(String(ready));
                });

                it.each([true, false])("should collect secret storage key in account %s", async (stored) => {
                    mocked(mockClient.secretStorage.hasKey).mockResolvedValue(stored);
                    const formData = await collectBugReport();
                    expect(formData.get("secret_storage_key_in_account")).toBe(String(stored));
                });

                it("should collect backup version", async () => {
                    mocked(mockClient.isKeyBackupKeyStored).mockResolvedValue({});

                    const formData = await collectBugReport();
                    expect(formData.get("session_backup_key_in_secret_storage")).toBe(String(true));

                    {
                        mocked(mockClient.isKeyBackupKeyStored).mockResolvedValue(null);

                        const formData = await collectBugReport();
                        expect(formData.get("session_backup_key_in_secret_storage")).toBe(String(false));
                    }
                });

                it("should collect backup key cached", async () => {
                    mocked(mockClient.getCrypto()!.getSessionBackupPrivateKey).mockResolvedValue(
                        new Uint8Array([0, 0]),
                    );

                    const formData = await collectBugReport();
                    expect(formData.get("session_backup_key_cached")).toBe(String(true));
                    expect(formData.get("session_backup_key_well_formed")).toBe(String(true));
                });
            });
        });
    });

    describe("Synapse info", () => {
        beforeEach(() => {
            fetchMock.reset();
        });

        it("should collect synapse admin keys if available", async () => {
            fetchMock.get("path:/_synapse/admin/v1/server_version", {
                server_version: "1.101.0 (b=matrix-org-hotfixes,6dbedcf601)",
                python_version: "3.7.8",
            });

            const formData = await collectBugReport();
            expect(formData.get("matrix_hs_server_version")).toBe("1.101.0 (b=matrix-org-hotfixes,6dbedcf601)");
            expect(formData.get("matrix_hs_python_version")).toBe("3.7.8");
        });

        it("should collect synapse admin keys with federation", async () => {
            fetchMock.get("path:/_synapse/admin/v1/server_version", {
                status: 404,
            });
            fetchMock.get("path:/_matrix/client/v3/login", {
                status: 404,
            });

            fetchMock.get("path:/.well-known/matrix/server", {
                "m.server": "matrix-federation.example.com:443",
            });

            fetchMock.get("https://matrix-federation.example.com/_matrix/federation/v1/version", {
                server: {
                    name: "Synapse",
                    version: "1.101.0 (b=matrix-org-hotfixes,6dbedcf601)",
                },
            });

            const formData = await collectBugReport();
            expect(formData.get("matrix_hs_name")).toBe("Synapse");
            expect(formData.get("matrix_hs_version")).toBe("1.101.0 (b=matrix-org-hotfixes,6dbedcf601)");
        });

        it("should collect synapse admin keys with fallback", async () => {
            fetchMock.get("path:/_synapse/admin/v1/server_version", {
                status: 404,
            });
            fetchMock.get("path:/.well-known/matrix/server", {
                status: 404,
            });

            fetchMock.get("path:/_matrix/client/v3/login", {
                status: 200,
                body: {},
                headers: {
                    Server: "some_cdn",
                },
            });

            const formData = await collectBugReport();
            expect(formData.get("matrix_hs_server")).toBe("some_cdn");
        });
    });

    describe("Settings Store", () => {
        const mockSettingsStore = mocked(SettingsStore);

        it("should collect labs from settings store", async () => {
            const someFeatures = [
                "feature_video_rooms",
                "feature_notification_settings2",
            ] as unknown[] as FeatureSettingKey[];
            const enabledFeatures: SettingKey[] = ["feature_video_rooms"];
            jest.spyOn(mockSettingsStore, "getFeatureSettingNames").mockReturnValue(someFeatures);
            jest.spyOn(mockSettingsStore, "getValue").mockImplementation((settingName): any => {
                return enabledFeatures.includes(settingName);
            });

            const formData = await collectBugReport();
            expect(formData.get("enabled_labs")).toBe(enabledFeatures.join(", "));
        });

        it("should collect low bandWidth enabled", async () => {
            jest.spyOn(mockSettingsStore, "getValue").mockImplementation((settingName): any => {
                if (settingName == "lowBandwidth") {
                    return true;
                }
            });

            const formData = await collectBugReport();
            expect(formData.get("lowBandwidth")).toBe("enabled");
        });
        it("should collect low bandWidth disabled", async () => {
            jest.spyOn(mockSettingsStore, "getValue").mockImplementation((settingName): any => {
                if (settingName == "lowBandwidth") {
                    return false;
                }
            });

            const formData = await collectBugReport();
            expect(formData.get("lowBandwidth")).toBeNull();
        });
    });

    describe("Navigator Storage", () => {
        let mockNavigator: Mocked<Navigator>;
        let navigatorSpy: jest.SpyInstance;

        beforeEach(() => {
            mockNavigator = {
                storage: {
                    estimate: jest.fn(),
                    persisted: jest.fn(),
                },
            } as unknown as Mocked<Navigator>;
            // @ts-ignore - We just need partial mock
            navigatorSpy = jest.spyOn(global, "navigator", "get").mockReturnValue(mockNavigator);
        });

        afterEach(() => {
            navigatorSpy.mockRestore();
        });

        it("should collect navigator storage persisted", async () => {
            mocked(mockNavigator.storage.persisted).mockResolvedValue(true);
            const formData = await collectBugReport();
            expect(formData.get("storageManager_persisted")).toBe("true");
        });

        it("should collect navigator storage safari", async () => {
            mocked(mockNavigator.storage.persisted).mockResolvedValue(true);
            // @ts-ignore - Need to mock the safari
            jest.replaceProperty(mockNavigator, "storage", undefined);

            const mockDocument = {
                hasStorageAccess: jest.fn().mockReturnValue(true),
            } as unknown as Mocked<Document>;

            const spy = jest.spyOn(global, "document", "get").mockReturnValue(mockDocument);

            const formData = await collectBugReport();
            expect(formData.get("storageManager_persisted")).toBe("true");

            spy.mockRestore();
        });

        it("should collect navigator storage estimate", async () => {
            const estimate = {
                quota: 596797550592,
                usage: 9147087,
                usageDetails: {
                    indexedDB: 9147045,
                    serviceWorkerRegistrations: 42,
                },
            };
            mocked(mockNavigator.storage.estimate).mockResolvedValue(estimate);

            const formData = await collectBugReport();
            expect(formData.get("storageManager_quota")).toEqual(estimate.quota.toString());
            expect(formData.get("storageManager_usage")).toEqual(estimate.usage.toString());
            expect(formData.get("storageManager_usage_indexedDB")).toEqual(
                estimate.usageDetails["indexedDB"].toString(),
            );
            expect(formData.get("storageManager_usage_serviceWorkerRegistrations")).toEqual(
                estimate.usageDetails["serviceWorkerRegistrations"].toString(),
            );
        });
    });

    it("should collect modernizer", async () => {
        const allFeatures = {
            cssanimations: false,
            flexbox: true,
            d0: false,
            d1: false,
            crypto: true,
        };
        const disabledFeatures = ["cssanimations", "d0", "d1"];
        const mockWindow = {
            Modernizr: {
                ...allFeatures,
            },
        } as unknown as Mocked<Window>;
        // @ts-ignore - We just need partial mock
        const windowSpy = jest.spyOn(global, "window", "get").mockReturnValue(mockWindow);

        const formData = await collectBugReport();

        expect(formData.get("modernizr_missing_features")).toBe(disabledFeatures.join(", "));

        windowSpy.mockRestore();
    });

    it("should collect localstorage settings", async () => {
        const localSettings = {
            language: "fr",
            showHiddenEventsInTimeline: true,
            activeCallRoomIds: [],
        };

        const spy = jest.spyOn(window.localStorage.__proto__, "getItem").mockImplementation((key) => {
            return JSON.stringify(localSettings);
        });

        const formData = await collectBugReport();
        expect(formData.get("mx_local_settings")).toBe(JSON.stringify(localSettings));

        spy.mockRestore();
    });

    it("should collect logs", async () => {
        const mockConsoleLogger = {
            flush: jest.fn(),
            consume: jest.fn(),
            warn: jest.fn(),
        } as unknown as Mocked<ConsoleLogger>;

        // @ts-ignore - mock the console logger
        global.mx_rage_logger = mockConsoleLogger;

        // @ts-ignore
        mockConsoleLogger.flush.mockReturnValue([
            {
                id: "instance-0",
                line: "line 1",
            },
            {
                id: "instance-1",
                line: "line 2",
            },
        ]);

        const formData = await collectBugReport({ sendLogs: true });

        expect(formData.get("compressed-log")).toBeDefined();
    });

    describe("A-Element-R label", () => {
        test("should add A-Element-R label if rust crypto", async () => {
            mocked(mockClient.getCrypto()!.getVersion).mockReturnValue(RUST_CRYPTO_VERSION);

            const formData = await collectBugReport();
            const labelNames = formData.getAll("label");
            expect(labelNames).toContain("A-Element-R");
        });

        test("should add A-Element-R label if rust crypto and new version", async () => {
            mocked(mockClient.getCrypto()!.getVersion).mockReturnValue("Rust SDK 0.9.3 (909d09fd), Vodozemac 0.8.1");

            const formData = await collectBugReport();
            const labelNames = formData.getAll("label");
            expect(labelNames).toContain("A-Element-R");
        });

        test("should not add A-Element-R label if not rust crypto", async () => {
            mocked(mockClient.getCrypto()!.getVersion).mockReturnValue(OLM_CRYPTO_VERSION);

            const formData = await collectBugReport();
            const labelNames = formData.getAll("label");
            expect(labelNames).not.toContain("A-Element-R");
        });

        test("should add A-Element-R label to the set of requested labels", async () => {
            mocked(mockClient.getCrypto()!.getVersion).mockReturnValue(RUST_CRYPTO_VERSION);

            const formData = await collectBugReport({
                labels: ["Z-UISI", "Foo"],
            });
            const labelNames = formData.getAll("label");
            expect(labelNames).toContain("A-Element-R");
            expect(labelNames).toContain("Z-UISI");
            expect(labelNames).toContain("Foo");
        });

        test("should not panic if there is no crypto", async () => {
            mocked(mockClient.getCrypto).mockReturnValue(undefined);

            const formData = await collectBugReport();
            const labelNames = formData.getAll("label");
            expect(labelNames).not.toContain("A-Element-R");
        });
    });

    it("should notify progress", () => {
        const progressCallback = jest.fn();

        collectBugReport({ progressCallback });

        expect(progressCallback).toHaveBeenCalled();
    });
});
