/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IContent } from "matrix-js-sdk/src/matrix";
import { type AccountDataEvents } from "matrix-js-sdk/src/types";

import {
    MEDIA_PREVIEW_ACCOUNT_DATA_TYPE,
    type MediaPreviewConfig,
    MediaPreviewValue,
} from "../../@types/media_preview.ts";
import { type SettingLevel } from "../SettingLevel.ts";
import MatrixClientBackedController from "./MatrixClientBackedController.ts";

/**
 * Handles media preview settings provided by MSC4278.
 * This uses both account-level and room-level account data.
 */
export default class MediaPreviewConfigController extends MatrixClientBackedController {
    public static readonly default: AccountDataEvents[typeof MEDIA_PREVIEW_ACCOUNT_DATA_TYPE] = {
        media_previews: MediaPreviewValue.On,
        invite_avatars: MediaPreviewValue.On,
    };

    private static getValidSettingData(content: IContent): MediaPreviewConfig {
        const mediaPreviews: MediaPreviewValue = content.media_previews;
        const inviteAvatars: MediaPreviewValue = content.invite_avatars;
        const validValues = Object.values(MediaPreviewValue);
        return {
            invite_avatars: validValues.includes(inviteAvatars)
                ? inviteAvatars
                : MediaPreviewConfigController.default.invite_avatars,
            media_previews: validValues.includes(mediaPreviews)
                ? mediaPreviews
                : MediaPreviewConfigController.default.media_previews,
        };
    }

    public constructor() {
        super();
    }

    private getValue = (roomId?: string): MediaPreviewConfig | null => {
        const source = roomId ? this.client?.getRoom(roomId) : this.client;
        const value = source?.getAccountData(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE)?.getContent<MediaPreviewConfig>();

        if (!value) {
            return null;
        } else {
            return MediaPreviewConfigController.getValidSettingData(value);
        }
    };

    protected async initMatrixClient(): Promise<void> {
        // Unused
    }

    public getValueOverride(_level: SettingLevel, roomId: string | null): MediaPreviewConfig {
        const roomConfig = roomId && this.getValue(roomId);
        if (roomConfig) {
            return roomConfig;
        }
        // If no room config, or global settings request then return global.
        return this.getValue() ?? MediaPreviewConfigController.default;
    }

    public get settingDisabled(): false {
        // No homeserver support is required for this MSC.
        return false;
    }

    public async beforeChange(
        _level: SettingLevel,
        roomId: string | null,
        newValue: MediaPreviewConfig,
    ): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        if (roomId) {
            await this.client.setRoomAccountData(roomId, MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, newValue);
            return true;
        }
        await this.client.setAccountData(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, newValue);
        return true;
    }
}
