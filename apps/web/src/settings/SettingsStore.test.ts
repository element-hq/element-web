/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { ClientEvent, type MatrixClient, type Room, SyncState } from "matrix-js-sdk/src/matrix";
import { waitFor } from "test-utils-rtl";

import type BasePlatform from "../BasePlatform";
import SdkConfig from "../SdkConfig";
import { SettingLevel } from "./SettingLevel";
import SettingsStore from "./SettingsStore";
import { mkStubRoom, mockPlatformPeg, stubClient } from "../../test/test-utils";
import { SETTINGS, type SettingKey } from "./Settings.tsx";
import MatrixClientBackedController from "./controllers/MatrixClientBackedController.ts";
import SettingController from "./controllers/SettingController.ts";

const TEST_DATA = [
    {
        name: "Electron.showTrayIcon" as SettingKey,
        level: SettingLevel.PLATFORM,
        value: true,
    },
];

/**
 * An existing setting that has {@link IBaseSetting#supportedLevelsAreOrdered} set to true.
 */
const SETTING_NAME_WITH_CONFIG_OVERRIDE = "feature_msc3531_hide_messages_pending_moderation";

describe("SettingsStore", () => {
    let platformSettings: Record<string, any>;

    beforeAll(() => {
        vi.clearAllMocks();
        platformSettings = {};
        mockPlatformPeg({
            isLevelSupported: vi.fn().mockReturnValue(true),
            supportsSetting: vi.fn().mockReturnValue(true),
            setSettingValue: vi.fn().mockImplementation((settingName: string, value: any) => {
                platformSettings[settingName] = value;
            }),
            getSettingValue: vi.fn().mockImplementation((settingName: string) => {
                return platformSettings[settingName];
            }),
            reload: vi.fn(),
        } as unknown as BasePlatform);

        TEST_DATA.forEach((d) => {
            SettingsStore.setValue(d.name, null, d.level, d.value);
        });
    });

    beforeEach(() => {
        SdkConfig.reset();
        SettingsStore.reset();
    });

    describe("getValueAt", () => {
        TEST_DATA.forEach((d) => {
            it(`should return the value "${d.level}"."${d.name}"`, () => {
                expect(SettingsStore.getValueAt(d.level, d.name)).toBe(d.value);
                // regression test #22545
                expect(SettingsStore.getValueAt(d.level, d.name)).toBe(d.value);
            });
        });

        it(`supportedLevelsAreOrdered correctly overrides setting`, async () => {
            SdkConfig.put({
                features: {
                    [SETTING_NAME_WITH_CONFIG_OVERRIDE]: false,
                },
            });
            await SettingsStore.setValue(SETTING_NAME_WITH_CONFIG_OVERRIDE, null, SettingLevel.DEVICE, true);
            expect(SettingsStore.getValue(SETTING_NAME_WITH_CONFIG_OVERRIDE)).toBe(false);
        });

        it(`supportedLevelsAreOrdered doesn't incorrectly override setting`, async () => {
            await SettingsStore.setValue(SETTING_NAME_WITH_CONFIG_OVERRIDE, null, SettingLevel.DEVICE, true);
            expect(SettingsStore.getValueAt(SettingLevel.DEVICE, SETTING_NAME_WITH_CONFIG_OVERRIDE)).toBe(true);
        });
    });

    describe("multiple controllers", () => {
        /**
         * An existing device-level boolean setting which has no controller of its own, so the
         * tests below can attach their own without disturbing real behaviour.
         */
        const SETTING_NAME = "showHiddenEventsInTimeline";

        /** A controller which records the calls it receives and can be told how to answer. */
        class TestController extends SettingController {
            public readonly calls: string[] = [];

            public constructor(
                private readonly answers: { override?: any; allowChange?: boolean; disabled?: boolean | string } = {},
            ) {
                super();
            }

            public getValueOverride(): any {
                this.calls.push("getValueOverride");
                return this.answers.override ?? null;
            }

            public async beforeChange(): Promise<boolean> {
                this.calls.push("beforeChange");
                return this.answers.allowChange ?? true;
            }

            public onChange(): void {
                this.calls.push("onChange");
            }

            public get settingDisabled(): boolean | string {
                return this.answers.disabled ?? false;
            }
        }

        const setControllers = (...controllers: SettingController[]): void => {
            SETTINGS[SETTING_NAME].controller = controllers;
        };

        afterEach(() => {
            SETTINGS[SETTING_NAME].controller = undefined;
        });

        it("uses the first override given, and does not consult the controllers after it", () => {
            const [noOverride, override, ignored] = [
                new TestController(),
                new TestController({ override: true }),
                new TestController({ override: false }),
            ];
            setControllers(noOverride, override, ignored);

            expect(SettingsStore.getValue(SETTING_NAME)).toBe(true);
            expect(noOverride.calls).toEqual(["getValueOverride"]);
            expect(ignored.calls).toEqual([]);
        });

        it("tells every controller about a change which goes through", async () => {
            const [first, second] = [new TestController(), new TestController()];
            setControllers(first, second);

            await SettingsStore.setValue(SETTING_NAME, null, SettingLevel.DEVICE, true);
            expect(first.calls).toEqual(["beforeChange", "onChange"]);
            expect(second.calls).toEqual(["beforeChange", "onChange"]);
        });

        it("stops at the first controller which refuses a change", async () => {
            const [refuses, ignored] = [new TestController({ allowChange: false }), new TestController()];
            setControllers(refuses, ignored);

            await SettingsStore.setValue(SETTING_NAME, null, SettingLevel.DEVICE, true);
            expect(refuses.calls).toEqual(["beforeChange"]);
            expect(ignored.calls).toEqual([]);
        });

        it("is disabled if any controller disables it, preferring one which gives a reason", () => {
            setControllers(new TestController({ disabled: true }), new TestController({ disabled: "Not today" }));

            expect(SettingsStore.canSetValue(SETTING_NAME, null, SettingLevel.DEVICE)).toBe(false);
            expect(SettingsStore.disabledMessage(SETTING_NAME)).toBe("Not today");
        });
    });

    describe("exportForRageshake", () => {
        it("should not export settings marked as non-exportable", async () => {
            await SettingsStore.setValue("userTimezone", null, SettingLevel.DEVICE, "Europe/London");
            const values = JSON.parse(SettingsStore.exportForRageshake()) as Record<SettingKey, unknown>;
            for (const exportedKey of Object.keys(values) as SettingKey[]) {
                expect(SETTINGS[exportedKey].shouldExportToRageshake).not.toEqual(false);
            }
        });
    });

    describe("runMigrations", () => {
        let client: MatrixClient;
        let room: Room;

        beforeEach(() => {
            client = stubClient();
            room = mkStubRoom("!room:example.org", "Room", client);
            client.getRooms = vi.fn().mockReturnValue([room]);
            client.getRoom = vi.fn().mockReturnValue(room);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        describe("Migrate media preview configuration", () => {
            beforeEach(() => {
                MatrixClientBackedController.matrixClient = client;
                client.getAccountData = vi.fn().mockImplementation((type) => {
                    if (type === "im.vector.web.settings") {
                        return {
                            getContent: vi.fn().mockReturnValue({
                                showImages: false,
                                showAvatarsOnInvites: false,
                            }),
                        };
                    } else {
                        return undefined;
                    }
                });
            });

            it("migrates media preview configuration immediately", async () => {
                client.setAccountData = vi.fn();
                SettingsStore.runMigrations(false);
                expect(client.setAccountData).toHaveBeenCalledWith("io.element.msc4278.media_preview_config", {
                    invite_avatars: "off",
                    media_previews: "off",
                });
            });
            it("migrates media preview configuration once client is ready", async () => {
                client.setAccountData = vi.fn();
                const mockInitialSync = (client.isInitialSyncComplete = vi.fn().mockReturnValue(false));
                SettingsStore.runMigrations(false);
                mockInitialSync.mockReturnValue(true);
                client.emit(ClientEvent.Sync, SyncState.Prepared, null);
                // Update is asynchronous
                await waitFor(() => {
                    expect(client.setAccountData).toHaveBeenCalledWith("io.element.msc4278.media_preview_config", {
                        invite_avatars: "off",
                        media_previews: "off",
                    });
                });
            });

            it("does not migrate media preview configuration if the session is fresh", async () => {
                client.setAccountData = vi.fn();
                SettingsStore.runMigrations(true);
                client.emit(ClientEvent.Sync, SyncState.Prepared, null);
                expect(client.setAccountData).not.toHaveBeenCalled();
            });

            it("does not migrate media preview configuration if the account data is already set", async () => {
                client.setAccountData = vi.fn();
                client.getAccountData = vi.fn().mockReturnValue({});
                SettingsStore.runMigrations(false);
                client.emit(ClientEvent.Sync, SyncState.Prepared, null);
                expect(client.setAccountData).not.toHaveBeenCalled();
            });
        });
    });
});
