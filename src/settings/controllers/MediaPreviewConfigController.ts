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

    private static getValidSettingData(content: IContent): Partial<MediaPreviewConfig> {
        const mediaPreviews: MediaPreviewConfig["media_previews"] = content.media_previews;
        const inviteAvatars: MediaPreviewConfig["invite_avatars"] = content.invite_avatars;
        const validMediaPreviews = Object.values(MediaPreviewValue);
        const validInviteAvatars = [MediaPreviewValue.Off, MediaPreviewValue.On];
        return {
            invite_avatars: validInviteAvatars.includes(inviteAvatars) ? inviteAvatars : undefined,
            media_previews: validMediaPreviews.includes(mediaPreviews) ? mediaPreviews : undefined,
        };
    }

    public constructor() {
        super();
    }

    private getValue = (roomId?: string): MediaPreviewConfig => {
        const source = roomId ? this.client?.getRoom(roomId) : this.client;
        const accountData =
            source?.getAccountData(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE)?.getContent<MediaPreviewConfig>() ?? {};

        const calculatedConfig = MediaPreviewConfigController.getValidSettingData(accountData);

        // Save an account data fetch if we have all the values.
        if (calculatedConfig.invite_avatars && calculatedConfig.media_previews) {
            return calculatedConfig as MediaPreviewConfig;
        }

        // We're missing some keys.
        if (roomId) {
            const globalConfig = this.getValue();
            return {
                invite_avatars:
                    calculatedConfig.invite_avatars ??
                    globalConfig.invite_avatars ??
                    MediaPreviewConfigController.default.invite_avatars,
                media_previews:
                    calculatedConfig.media_previews ??
                    globalConfig.media_previews ??
                    MediaPreviewConfigController.default.media_previews,
            };
        }
        return {
            invite_avatars: calculatedConfig.invite_avatars ?? MediaPreviewConfigController.default.invite_avatars,
            media_previews: calculatedConfig.media_previews ?? MediaPreviewConfigController.default.media_previews,
        };
    };

    public getValueOverride(_level: SettingLevel, roomId: string | null): MediaPreviewConfig {
        return this.getValue(roomId ?? undefined);
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
