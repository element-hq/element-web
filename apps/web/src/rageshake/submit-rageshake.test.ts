/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi, type Mocked, type MockInstance } from "vitest";
import {
    type HttpApiEvent,
    type HttpApiEventHandlerMap,
    type IHttpOpts,
    type MatrixClient,
    TypedEventEmitter,
    MatrixHttpApi,
} from "matrix-js-sdk/src/matrix";
import { CrossSigningKey } from "matrix-js-sdk/src/crypto-api";
import fetchMock from "@fetch-mock/vitest";
import { getMockClientWithEventEmitter, mockClientMethodsCrypto, mockPlatformPeg } from "test-utils";

import { collectBugReport, downloadBugReport, submitFeedback } from "./submit-rageshake";
import SettingsStore from "../settings/SettingsStore";
import { type ConsoleLogger } from "./rageshake";
import { type FeatureSettingKey, type SettingKey } from "../settings/Settings.tsx";
import { SettingLevel } from "../settings/SettingLevel.ts";
import SdkConfig from "../SdkConfig.ts";
import { BugReportEndpointURLLocal } from "../IConfigOptions.ts";
import { MatrixClientPeg } from "../MatrixClientPeg.ts";
import { SDKContextClass } from "../contexts/SDKContextClass.ts";

describe("Rageshakes", () => {
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
            getHomeserverUrl: vi.fn().mockReturnValue("https://alice-server.com"),
            getDomain: vi.fn().mockReturnValue("alice-server.com"),
            ...mockClientMethodsCrypto(),
            http: mockHttpAPI,
        });
        vi.mocked(mockClient.getCrypto()!.getOwnDeviceKeys).mockResolvedValue({
            ed25519: "",
            curve25519: "",
        });

        vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Basic Information", () => {
        it("should include app version", async () => {
            mockPlatformPeg({ getAppVersion: vi.fn().mockReturnValue("1.11.58") });

            const formData = await collectBugReport();

            const appVersion = formData.get("version");

            expect(appVersion).toBe("1.11.58");
        });

        it("should put unknown app version if on dev", async () => {
            mockPlatformPeg({ getAppVersion: vi.fn().mockRejectedValue(undefined) });

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
            vi.mocked(window.matchMedia).mockImplementation((q): MediaQueryList => {
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
            vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("vitest navigator");
            const formData = await collectBugReport();
            const userAgent = formData.get("user_agent");
            expect(userAgent).toBe("vitest navigator");

            // @ts-ignore - Need to force navigator to be undefined for test
            vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(undefined);
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
            vi.mocked(mockClient.getCrypto()!.getVersion).mockReturnValue("0.0.0");
            const formData = await collectBugReport();

            expect(formData.get("crypto_version")).toBe("0.0.0");
        });

        it("should collect device keys", async () => {
            const ownDeviceKeys = {
                curve25519: "curve25519b64",
                ed25519: "ed25519b64",
            };

            vi.mocked(mockClient.getCrypto()!.getOwnDeviceKeys).mockResolvedValue(ownDeviceKeys);

            const keys = [`curve25519:${ownDeviceKeys.curve25519}`, `ed25519:${ownDeviceKeys.ed25519}`].join(", ");

            const formData = await collectBugReport();

            expect(formData.get("device_keys")).toBe(keys);
        });

        describe("Cross-Signing", () => {
            it.each([true, false])("should collect cross-signing ready %s", async (ready) => {
                vi.mocked(mockClient.getCrypto()!.isCrossSigningReady).mockResolvedValue(ready);

                const formData = await collectBugReport();

                expect(formData.get("cross_signing_ready")).toBe(String(ready));
            });

            it("should collect cross-signing pub key if set", async () => {
                const crossSigningPubKey = "crossSigningPubKey";
                vi.mocked(mockClient.getCrypto()!.getCrossSigningKeyId).mockImplementation(
                    async (type): Promise<string | null> => {
                        if (!type || type === CrossSigningKey.Master) {
                            return crossSigningPubKey;
                        }
                        return null;
                    },
                );

                const formData = await collectBugReport();

                expect(formData.get("cross_signing_key")).toBe(crossSigningPubKey);
            });

            it("should not collect cross-signing pub key if not set", async () => {
                vi.mocked(mockClient.getCrypto()!.getCrossSigningKeyId).mockResolvedValue(null);
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
                    vi.mocked(mockClient.getCrypto()!.getCrossSigningStatus).mockResolvedValue({
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
                        vi.mocked(mockClient.getCrypto()!.getCrossSigningStatus).mockResolvedValue({
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
                    vi.mocked(mockClient.getCrypto()!.isSecretStorageReady).mockResolvedValue(ready);

                    const formData = await collectBugReport();

                    expect(formData.get("secret_storage_ready")).toBe(String(ready));
                });

                it.each([true, false])("should collect secret storage key in account %s", async (stored) => {
                    vi.mocked(mockClient.secretStorage.hasKey).mockResolvedValue(stored);
                    const formData = await collectBugReport();
                    expect(formData.get("secret_storage_key_in_account")).toBe(String(stored));
                });

                it("should collect backup version", async () => {
                    vi.mocked(mockClient.isKeyBackupKeyStored).mockResolvedValue({});

                    const formData = await collectBugReport();
                    expect(formData.get("session_backup_key_in_secret_storage")).toBe(String(true));

                    {
                        vi.mocked(mockClient.isKeyBackupKeyStored).mockResolvedValue(null);

                        const formData = await collectBugReport();
                        expect(formData.get("session_backup_key_in_secret_storage")).toBe(String(false));
                    }
                });

                it("should collect backup key cached", async () => {
                    vi.mocked(mockClient.getCrypto()!.getSessionBackupPrivateKey).mockResolvedValue(
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
        beforeEach(() => {
            vi.spyOn(SDKContextClass.instance.notifier, "isPossible").mockReturnValue(true);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("should collect labs from settings store", async () => {
            const someFeatures = [
                "feature_video_rooms",
                "feature_notification_settings2",
            ] as unknown[] as FeatureSettingKey[];
            const enabledFeatures: SettingKey[] = ["feature_video_rooms"];
            vi.spyOn(SettingsStore, "getFeatureSettingNames").mockReturnValue(someFeatures);
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName): any => {
                return enabledFeatures.includes(settingName);
            });

            const formData = await collectBugReport();
            expect(formData.get("enabled_labs")).toBe(enabledFeatures.join(", "));
        });

        it("should collect low bandWidth enabled", async () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName): any => {
                if (settingName == "lowBandwidth") {
                    return true;
                }
            });

            const formData = await collectBugReport();
            expect(formData.get("lowBandwidth")).toBe("enabled");
        });
        it("should collect low bandWidth disabled", async () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName): any => {
                if (settingName == "lowBandwidth") {
                    return false;
                }
            });

            const formData = await collectBugReport();
            expect(formData.get("lowBandwidth")).toBeNull();
        });

        it("should handle settings throwing when logged out", async () => {
            vi.mocked(MatrixClientPeg.get).mockRestore();
            vi.mocked(MatrixClientPeg.safeGet).mockRestore();
            vi.spyOn(SDKContextClass.instance.notifier, "isPossible").mockImplementation(() => {
                throw new Error("Test");
            });

            const formData = await collectBugReport();
            expect(JSON.parse(formData.get("mx_local_settings") as string)["notificationsEnabled"]).toBe(
                "Failed to read setting!",
            );
        });

        it("should handle reading notification settings when logged out", async () => {
            vi.mocked(MatrixClientPeg.get).mockRestore();
            vi.mocked(MatrixClientPeg.safeGet).mockRestore();
            vi.spyOn(SDKContextClass.instance.notifier, "isPossible").mockReturnValue(true);

            const formData = await collectBugReport();
            expect(JSON.parse(formData.get("mx_local_settings") as string)["notificationsEnabled"]).toBe(false);
        });
    });

    describe("Navigator Storage", () => {
        let mockNavigator: Mocked<Navigator>;
        let navigatorSpy: MockInstance;

        beforeEach(() => {
            mockNavigator = {
                storage: {
                    estimate: vi.fn(),
                    persisted: vi.fn(),
                },
            } as unknown as Mocked<Navigator>;
            // @ts-ignore - We just need partial mock
            navigatorSpy = vi.spyOn(global, "navigator", "get").mockReturnValue(mockNavigator);
        });

        afterEach(() => {
            navigatorSpy.mockRestore();
            SettingsStore.reset();
        });

        it("should collect navigator storage persisted", async () => {
            vi.mocked(mockNavigator.storage.persisted).mockResolvedValue(true);
            const formData = await collectBugReport();
            expect(formData.get("storageManager_persisted")).toBe("true");
        });

        it("should collect navigator storage safari", async () => {
            vi.mocked(mockNavigator.storage.persisted).mockResolvedValue(true);
            // @ts-ignore - Need to mock the safari
            mockNavigator.storage = undefined as any;

            const spy = vi.spyOn(global, "document", "get").mockReturnValue({
                hasStorageAccess: vi.fn().mockReturnValue(true),
            } as any);

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
            vi.mocked(mockNavigator.storage.estimate).mockResolvedValue(estimate);

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
        const windowSpy = vi.spyOn(global, "window", "get").mockReturnValue({
            matchMedia: vi.fn().mockReturnValue({ matches: false }),
            Modernizr: {
                ...allFeatures,
            },
        } as any);

        const formData = await collectBugReport();

        expect(formData.get("modernizr_missing_features")).toBe(disabledFeatures.join(", "));

        windowSpy.mockRestore();
    });

    it("should collect localstorage settings", async () => {
        await SettingsStore.setValue("language", null, SettingLevel.DEVICE, "fr");
        await SettingsStore.setValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);
        await SettingsStore.setValue("userTimezone", null, SettingLevel.DEVICE, "Europe/London");
        await SettingsStore.setValue("activeCallRoomIds", null, SettingLevel.DEVICE, []);

        const formData = await collectBugReport();
        const settingDataJSON = formData.get("mx_local_settings");
        expect(settingDataJSON).not.toBeNull();
        const settingsData = JSON.parse(settingDataJSON as string);
        expect(settingsData.showHiddenEventsInTimeline).toEqual(true);
    });

    it("should collect logs for collectBugReport", async () => {
        const mockConsoleLogger = {
            flush: vi.fn(),
            consume: vi.fn(),
            warn: vi.fn(),
        } as unknown as Mocked<ConsoleLogger>;
        mockConsoleLogger.flush.mockReturnValue("line 1\nline 2\n");

        const prevLogger = global.mx_rage_logger;
        global.mx_rage_logger = mockConsoleLogger;
        try {
            const formData = await collectBugReport({ sendLogs: true });
            expect(formData.get("compressed-log")).toBeDefined();
        } finally {
            global.mx_rage_logger = prevLogger;
        }
    });

    it("should collect logs for downloadBugReport", async () => {
        const mockConsoleLogger = {
            flush: vi.fn(),
            consume: vi.fn(),
            warn: vi.fn(),
        } as unknown as Mocked<ConsoleLogger>;
        mockConsoleLogger.flush.mockReturnValue("line 1\nline 2\n");

        const prevLogger = global.mx_rage_logger;
        global.mx_rage_logger = mockConsoleLogger;
        const mockElement = {
            href: "",
            download: "",
            click: vi.fn(),
        };
        vi.spyOn(document, "createElement").mockReturnValue(mockElement as any);
        vi.spyOn(document, "body", "get").mockReturnValue({
            appendChild: vi.fn(),
            removeChild: vi.fn(),
        } as any);
        try {
            await downloadBugReport({ sendLogs: true });
        } finally {
            global.mx_rage_logger = prevLogger;
        }
        expect(document.createElement).toHaveBeenCalledWith("a");
        expect(mockElement.href).toMatch(/^data:application\/octet-stream;base64,.+/);
        expect(mockElement.download).toEqual("rageshake.tar");
        expect(mockElement.click).toHaveBeenCalledWith();
    });

    it("should notify progress", () => {
        const progressCallback = vi.fn();

        collectBugReport({ progressCallback });

        expect(progressCallback).toHaveBeenCalled();
    });

    describe("submitFeedback", () => {
        afterEach(() => {
            SdkConfig.reset();
        });
        it("fails if the URL is not defined", async () => {
            SdkConfig.put({ bug_report_endpoint_url: undefined });
            await expect(() => submitFeedback("label", "comment")).rejects.toThrow(
                "Bug report URL is not set or local",
            );
        });
        it("fails if the URL is 'local'", async () => {
            SdkConfig.put({ bug_report_endpoint_url: BugReportEndpointURLLocal });
            await expect(() => submitFeedback("label", "comment")).rejects.toThrow(
                "Bug report URL is not set or local",
            );
        });
    });
});
