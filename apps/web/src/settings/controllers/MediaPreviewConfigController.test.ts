/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, afterEach } from "vitest";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { getMockClientWithEventEmitter, mockClientMethodsServer } from "test-utils";

import MatrixClientBackedController from "./MatrixClientBackedController";
import MediaPreviewConfigController from "./MediaPreviewConfigController";
import { SettingLevel } from "../SettingLevel";
import {
    MEDIA_PREVIEW_ACCOUNT_DATA_TYPE,
    MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE,
    type MediaPreviewConfig,
    MediaPreviewValue,
} from "../../@types/media_preview";

/**
 * Builds a getAccountData mock which returns an event for each of the given types.
 */
function mockAccountData(data: Partial<Record<string, Partial<MediaPreviewConfig>>>) {
    return vi.fn().mockImplementation((type: string) => {
        const content = data[type];
        return content ? new MatrixEvent({ type, content }) : null;
    });
}

describe("MediaPreviewConfigController", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const ROOM_ID = "!room:example.org";

    it("gets the default settings when none are specified.", () => {
        const controller = new MediaPreviewConfigController();

        MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: vi.fn().mockReturnValue(null),
        });

        const value = controller.getValueOverride(SettingLevel.ACCOUNT, null);
        expect(value).toEqual(MediaPreviewConfigController.default);
    });

    it("gets the default settings when the setting is empty.", () => {
        const controller = new MediaPreviewConfigController();

        MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: vi
                .fn()
                .mockReturnValue(new MatrixEvent({ type: MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, content: {} })),
        });

        const value = controller.getValueOverride(SettingLevel.ACCOUNT, null);
        expect(value).toEqual(MediaPreviewConfigController.default);
    });

    it.each([["media_previews"], ["invite_avatars"]])("gets the correct value for %s at the global level", (key) => {
        const controller = new MediaPreviewConfigController();

        MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: vi.fn().mockReturnValue(
                new MatrixEvent({
                    type: MEDIA_PREVIEW_ACCOUNT_DATA_TYPE,
                    content: {
                        [key]: MediaPreviewValue.Off,
                    },
                }),
            ),
            getRoom: vi.fn().mockReturnValue({
                getAccountData: vi.fn().mockReturnValue(null),
            }),
        });

        const globalValue = controller.getValueOverride(SettingLevel.ACCOUNT, null);
        expect(globalValue[key]).toEqual(MediaPreviewValue.Off);

        // Should follow the global value.
        const roomValue = controller.getValueOverride(SettingLevel.ROOM_ACCOUNT, ROOM_ID);
        expect(roomValue[key]).toEqual(MediaPreviewValue.Off);
    });

    it.each([["media_previews"], ["invite_avatars"]])("gets the correct value for %s at the room level", (key) => {
        const controller = new MediaPreviewConfigController();

        MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            getAccountData: vi.fn().mockReturnValue(null),
            getRoom: vi.fn().mockReturnValue({
                getAccountData: vi.fn().mockReturnValue(
                    new MatrixEvent({
                        type: MEDIA_PREVIEW_ACCOUNT_DATA_TYPE,
                        content: {
                            [key]: MediaPreviewValue.Off,
                        },
                    }),
                ),
            }),
        });

        const globalValue = controller.getValueOverride(SettingLevel.ACCOUNT, null);
        expect(globalValue[key]).toEqual(MediaPreviewValue.On);

        // Should follow the global value.
        const roomValue = controller.getValueOverride(SettingLevel.ROOM_ACCOUNT, ROOM_ID);
        expect(roomValue[key]).toEqual(MediaPreviewValue.Off);
    });

    it.each([["media_previews"], ["invite_avatars"]])(
        "uses defaults when an invalid value is set on the global level",
        (key) => {
            const controller = new MediaPreviewConfigController();

            MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                getAccountData: vi.fn().mockReturnValue(
                    new MatrixEvent({
                        type: MEDIA_PREVIEW_ACCOUNT_DATA_TYPE,
                        content: {
                            [key]: "bibble",
                        },
                    }),
                ),
                getRoom: vi.fn().mockReturnValue({
                    getAccountData: vi.fn().mockReturnValue(null),
                }),
            });

            const globalValue = controller.getValueOverride(SettingLevel.ACCOUNT, null);
            expect(globalValue[key]).toEqual(MediaPreviewValue.On);

            // Should follow the global value.
            const roomValue = controller.getValueOverride(SettingLevel.ROOM_ACCOUNT, ROOM_ID);
            expect(roomValue[key]).toEqual(MediaPreviewValue.On);
        },
    );
    it.each([["media_previews"], ["invite_avatars"]])(
        "uses global value when an invalid value is set on the room level",
        (key) => {
            const controller = new MediaPreviewConfigController();

            MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                getAccountData: vi.fn().mockReturnValue(
                    new MatrixEvent({
                        type: MEDIA_PREVIEW_ACCOUNT_DATA_TYPE,
                        content: {
                            [key]: MediaPreviewValue.Off,
                        },
                    }),
                ),
                getRoom: vi.fn().mockReturnValue({
                    getAccountData: vi.fn().mockReturnValue(
                        new MatrixEvent({
                            type: MEDIA_PREVIEW_ACCOUNT_DATA_TYPE,
                            content: {
                                [key]: "bibble",
                            },
                        }),
                    ),
                }),
            });

            const globalValue = controller.getValueOverride(SettingLevel.ACCOUNT, null);
            expect(globalValue[key]).toEqual(MediaPreviewValue.Off);

            // Should follow the global value.
            const roomValue = controller.getValueOverride(SettingLevel.ROOM_ACCOUNT, ROOM_ID);
            expect(roomValue[key]).toEqual(MediaPreviewValue.Off);
        },
    );

    describe("stable and unstable account data types", () => {
        it("falls back to the unstable type when no stable type exists", () => {
            const controller = new MediaPreviewConfigController();
            MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                getAccountData: mockAccountData({
                    [MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE]: {
                        media_previews: MediaPreviewValue.Off,
                        invite_avatars: MediaPreviewValue.Off,
                    },
                }),
                getRoom: vi.fn().mockReturnValue({
                    getAccountData: mockAccountData({
                        [MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE]: { media_previews: MediaPreviewValue.Private },
                    }),
                }),
            });

            expect(controller.getValueOverride(SettingLevel.ACCOUNT, null)).toEqual({
                media_previews: MediaPreviewValue.Off,
                invite_avatars: MediaPreviewValue.Off,
            });
            expect(controller.getValueOverride(SettingLevel.ROOM_ACCOUNT, ROOM_ID)).toEqual({
                media_previews: MediaPreviewValue.Private,
                invite_avatars: MediaPreviewValue.Off,
            });
        });

        it("prefers the stable type over the unstable type at the same level", () => {
            const controller = new MediaPreviewConfigController();
            MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                getAccountData: mockAccountData({
                    [MEDIA_PREVIEW_ACCOUNT_DATA_TYPE]: {
                        media_previews: MediaPreviewValue.Private,
                        invite_avatars: MediaPreviewValue.On,
                    },
                    [MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE]: {
                        media_previews: MediaPreviewValue.Off,
                        invite_avatars: MediaPreviewValue.Off,
                    },
                }),
            });

            expect(controller.getValueOverride(SettingLevel.ACCOUNT, null)).toEqual({
                media_previews: MediaPreviewValue.Private,
                invite_avatars: MediaPreviewValue.On,
            });
        });

        it("does not merge stable and unstable types at the same level", () => {
            const controller = new MediaPreviewConfigController();
            MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                // Stable exists but is missing invite_avatars; the unstable value must NOT fill it in.
                getAccountData: mockAccountData({
                    [MEDIA_PREVIEW_ACCOUNT_DATA_TYPE]: { media_previews: MediaPreviewValue.Private },
                    [MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE]: {
                        media_previews: MediaPreviewValue.Off,
                        invite_avatars: MediaPreviewValue.Off,
                    },
                }),
            });

            expect(controller.getValueOverride(SettingLevel.ACCOUNT, null)).toEqual({
                media_previews: MediaPreviewValue.Private,
                invite_avatars: MediaPreviewConfigController.default.invite_avatars,
            });
        });

        it("merges a stable room-level type with an unstable global type", () => {
            const controller = new MediaPreviewConfigController();
            MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                getAccountData: mockAccountData({
                    [MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE]: { invite_avatars: MediaPreviewValue.Off },
                }),
                getRoom: vi.fn().mockReturnValue({
                    getAccountData: mockAccountData({
                        [MEDIA_PREVIEW_ACCOUNT_DATA_TYPE]: { media_previews: MediaPreviewValue.Private },
                    }),
                }),
            });

            expect(controller.getValueOverride(SettingLevel.ROOM_ACCOUNT, ROOM_ID)).toEqual({
                media_previews: MediaPreviewValue.Private,
                invite_avatars: MediaPreviewValue.Off,
            });
        });

        it("merges an unstable room-level type with a stable global type", () => {
            const controller = new MediaPreviewConfigController();
            MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                getAccountData: mockAccountData({
                    [MEDIA_PREVIEW_ACCOUNT_DATA_TYPE]: { invite_avatars: MediaPreviewValue.Off },
                }),
                getRoom: vi.fn().mockReturnValue({
                    getAccountData: mockAccountData({
                        [MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE]: { media_previews: MediaPreviewValue.Private },
                    }),
                }),
            });

            expect(controller.getValueOverride(SettingLevel.ROOM_ACCOUNT, ROOM_ID)).toEqual({
                media_previews: MediaPreviewValue.Private,
                invite_avatars: MediaPreviewValue.Off,
            });
        });

        it("writes new values to both the stable and unstable types", async () => {
            const controller = new MediaPreviewConfigController();
            const setAccountData = vi.fn().mockResolvedValue({});
            const setRoomAccountData = vi.fn().mockResolvedValue({});
            MatrixClientBackedController.matrixClient = getMockClientWithEventEmitter({
                ...mockClientMethodsServer(),
                setAccountData,
                setRoomAccountData,
            });
            const value: MediaPreviewConfig = {
                media_previews: MediaPreviewValue.Off,
                invite_avatars: MediaPreviewValue.Off,
            };

            await controller.beforeChange(SettingLevel.ACCOUNT, null, value);
            expect(setAccountData).toHaveBeenCalledTimes(2);
            expect(setAccountData).toHaveBeenCalledWith(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, value);
            expect(setAccountData).toHaveBeenCalledWith(MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE, value);

            await controller.beforeChange(SettingLevel.ROOM_ACCOUNT, ROOM_ID, value);
            expect(setRoomAccountData).toHaveBeenCalledTimes(2);
            expect(setRoomAccountData).toHaveBeenCalledWith(ROOM_ID, MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, value);
            expect(setRoomAccountData).toHaveBeenCalledWith(ROOM_ID, MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE, value);
        });
    });
});
