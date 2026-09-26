/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IContent, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { type AccountDataEvents } from "matrix-js-sdk/src/types";

import {
    MEDIA_PREVIEW_ACCOUNT_DATA_TYPE,
    MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE,
    type MediaPreviewConfig,
    MediaPreviewValue,
} from "../../@types/media_preview.ts";
import { type SettingLevel } from "../SettingLevel.ts";
import MatrixClientBackedController from "./MatrixClientBackedController.ts";

declare module "matrix-js-sdk/src/types" {
    interface RoomAccountDataEvents {
        [MEDIA_PREVIEW_ACCOUNT_DATA_TYPE]: MediaPreviewConfig;
        [MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE]: MediaPreviewConfig;
    }
}

/**
 * Handles media preview settings provided by MSC4278 / the `m.media_preview_config` module.
 * This uses both account-level and room-level account data.
 *
 * Both the stable (`m.media_preview_config`) and unstable (`io.element.msc4278.media_preview_config`)
 * account data types are read, with the stable type preferred. Within a single level (global or room)
 * only one of the two events is consulted: the stable one if present, otherwise the unstable one.
 * Missing properties then fall back per-property from room to global to defaults, as the spec requires.
 * New values are written to both types during the transition period, so older clients stay in sync.
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
            invite_avatars: validInviteAvatars.includes(inviteAvatars!) ? inviteAvatars : undefined,
            media_previews: validMediaPreviews.includes(mediaPreviews!) ? mediaPreviews : undefined,
        };
    }

    /**
     * Read the media preview config content from a single source (the client for global,
     * or a room for room-level), preferring the stable event type over the unstable one.
     * The two event types are never merged with each other at the same level.
     */
    private static getContentFromSource(source: MatrixClient | Room | null | undefined): IContent {
        const stableContent = source?.getAccountData(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE)?.getContent<MediaPreviewConfig>();
        if (stableContent) {
            return stableContent;
        }
        return source?.getAccountData(MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE)?.getContent<MediaPreviewConfig>() ?? {};
    }

    public constructor() {
        super();
    }

    private getValue = (roomId?: string): MediaPreviewConfig => {
        const source = roomId ? this.client?.getRoom(roomId) : this.client;
        const accountData = MediaPreviewConfigController.getContentFromSource(source);

        const calculatedConfig = MediaPreviewConfigController.getValidSettingData(accountData);

        // Save an account data fetch if we have all the values.
        if (calculatedConfig.invite_avatars && calculatedConfig.media_previews) {
            return calculatedConfig;
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
        // Write to both the stable and unstable types for now, so that older clients which only
        // read the unstable type stay in sync. The unstable write can be dropped once enough
        // clients read the stable type.
        if (roomId) {
            await Promise.all([
                this.client.setRoomAccountData(roomId, MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, newValue),
                this.client.setRoomAccountData(roomId, MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE, newValue),
            ]);
            return true;
        }
        await Promise.all([
            this.client.setAccountData(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, newValue),
            this.client.setAccountData(MEDIA_PREVIEW_UNSTABLE_ACCOUNT_DATA_TYPE, newValue),
        ]);
        return true;
    }
}
