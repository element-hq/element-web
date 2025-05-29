/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, useCallback } from "react";
import { Field, HelpMessage, InlineField, Label, RadioInput, Root } from "@vector-im/compound-web";

import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import { type MediaPreviewConfig, MediaPreviewValue } from "../../../../../@types/media_preview";
import { _t } from "../../../../../languageHandler";
import { useSettingValue } from "../../../../../hooks/useSettings";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";

export const MediaPreviewAccountSettings: React.FC<{ roomId?: string }> = ({ roomId }) => {
    const currentMediaPreview = useSettingValue("mediaPreviewConfig", roomId);

    const changeSetting = useCallback(
        (newValue: MediaPreviewConfig) => {
            SettingsStore.setValue(
                "mediaPreviewConfig",
                roomId ?? null,
                roomId ? SettingLevel.ROOM_ACCOUNT : SettingLevel.ACCOUNT,
                newValue,
            );
        },
        [roomId],
    );

    const avatarOnChange = useCallback(
        (c: boolean) => {
            changeSetting({
                ...currentMediaPreview,
                // Switch is inverted. "Hide avatars..."
                invite_avatars: c ? MediaPreviewValue.Off : MediaPreviewValue.On,
            });
        },
        [changeSetting, currentMediaPreview],
    );

    const mediaPreviewOnChangeOff = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (event) => {
            if (!event.target.checked) {
                return;
            }
            changeSetting({
                ...currentMediaPreview,
                media_previews: MediaPreviewValue.Off,
            });
        },
        [changeSetting, currentMediaPreview],
    );

    const mediaPreviewOnChangePrivate = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (event) => {
            if (!event.target.checked) {
                return;
            }
            changeSetting({
                ...currentMediaPreview,
                media_previews: MediaPreviewValue.Private,
            });
        },
        [changeSetting, currentMediaPreview],
    );

    const mediaPreviewOnChangeOn = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (event) => {
            if (!event.target.checked) {
                return;
            }
            changeSetting({
                ...currentMediaPreview,
                media_previews: MediaPreviewValue.On,
            });
        },
        [changeSetting, currentMediaPreview],
    );

    return (
        <Root className="mx_MediaPreviewAccountSetting_Form">
            {!roomId && (
                <LabelledToggleSwitch
                    className="mx_MediaPreviewAccountSetting_ToggleSwitch"
                    label={_t("settings|media_preview|hide_avatars")}
                    value={currentMediaPreview.invite_avatars === MediaPreviewValue.Off}
                    onChange={avatarOnChange}
                />
            )}
            {/* Explict label here because htmlFor is not supported for linking to radiogroups */}
            <Field
                id="mx_media_previews"
                role="radiogroup"
                name="media_previews"
                aria-label={_t("settings|media_preview|media_preview_label")}
            >
                <Label>{_t("settings|media_preview|media_preview_label")}</Label>
                <HelpMessage className="mx_MediaPreviewAccountSetting_RadioHelp">
                    {_t("settings|media_preview|media_preview_description")}
                </HelpMessage>
                <InlineField
                    name="media_preview_off"
                    className="mx_MediaPreviewAccountSetting_Radio"
                    control={
                        <RadioInput
                            id="mx_media_previews_off"
                            checked={currentMediaPreview.media_previews === MediaPreviewValue.Off}
                            onChange={mediaPreviewOnChangeOff}
                        />
                    }
                >
                    <Label htmlFor="mx_media_previews_off">{_t("settings|media_preview|hide_media")}</Label>
                </InlineField>
                {!roomId && (
                    <InlineField
                        name="mx_media_previews_private"
                        className="mx_MediaPreviewAccountSetting_Radio"
                        control={
                            <RadioInput
                                id="mx_media_previews_private"
                                checked={currentMediaPreview.media_previews === MediaPreviewValue.Private}
                                onChange={mediaPreviewOnChangePrivate}
                            />
                        }
                    >
                        <Label htmlFor="mx_media_previews_private">
                            {_t("settings|media_preview|show_in_private")}
                        </Label>
                    </InlineField>
                )}
                <InlineField
                    name="media_preview_on"
                    className="mx_MediaPreviewAccountSetting_Radio"
                    control={
                        <RadioInput
                            id="mx_media_previews_on"
                            checked={currentMediaPreview.media_previews === MediaPreviewValue.On}
                            onChange={mediaPreviewOnChangeOn}
                        />
                    }
                >
                    <Label htmlFor="mx_media_previews_on">{_t("settings|media_preview|show_media")}</Label>
                </InlineField>
            </Field>
        </Root>
    );
};
