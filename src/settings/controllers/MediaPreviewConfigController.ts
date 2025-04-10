/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent, type MatrixEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";
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
    public static readonly default: AccountDataEvents["io.element.msc4278.media_preview_config"] = {
        media_previews: MediaPreviewValue.On,
        invite_avatars: MediaPreviewValue.On,
    };

    private globalSetting: MediaPreviewConfig = MediaPreviewConfigController.default;

    private getRoomValue = (roomId: string): MediaPreviewConfig | null => {
        return (
            this.client
                ?.getRoom(roomId)
                ?.getAccountData(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE)
                ?.getContent<MediaPreviewConfig>() ?? null
        );
    };

    private onAccountData = (event: MatrixEvent): void => {
        if (event.getType() !== MEDIA_PREVIEW_ACCOUNT_DATA_TYPE) {
            return;
        }
        console.log("OnAccountData", event);
        // TODO: Validate.
        const roomId = event.getRoomId();
        if (!roomId) {
            this.globalSetting = {
                ...MediaPreviewConfigController.default,
                ...event.getContent(),
            };
        }
    };

    protected async initMatrixClient(newClient: MatrixClient, oldClient?: MatrixClient): Promise<void> {
        oldClient?.off(ClientEvent.AccountData, this.onAccountData);
        newClient.on(ClientEvent.AccountData, this.onAccountData);
        const accountData = newClient.getAccountData(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE);
        if (accountData) this.onAccountData(accountData);
    }

    public getValueOverride(level: SettingLevel, roomId: string | null): MediaPreviewConfig {
        // TODO: Use SettingLevel?
        if (roomId) {
            // Use globals for any undefined setting
            return {
                ...this.getRoomValue(roomId),
                ...this.globalSetting,
            };
        }
        return this.globalSetting;
    }

    public get settingDisabled(): boolean | string {
        return false;
    }

    public async beforeChange(
        level: SettingLevel,
        roomId: string | null,
        newValue: MediaPreviewConfig,
    ): Promise<boolean> {
        if (!this.client) {
            return false;
        }
        if (roomId) {
            await this.client.setRoomAccountData(roomId, MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, {
                value: newValue,
            });
            return true;
        }
        await this.client.setAccountData(MEDIA_PREVIEW_ACCOUNT_DATA_TYPE, newValue);
        return true;
    }
}
