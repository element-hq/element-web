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
import { MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, MediaPreviewValue } from "../../@types/media_preview";

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
});
