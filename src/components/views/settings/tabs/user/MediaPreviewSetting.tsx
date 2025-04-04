import React, { ChangeEventHandler } from "react";
import { Field, HelpMessage, InlineField, Label, RadioInput, Root } from "@vector-im/compound-web";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import { useCallback } from "react";
import { MediaPreviewConfig, MediaPreviewValue } from "../../../../../@types/media_preview";
import { _t } from "../../../../../languageHandler";
import { useSettingValue } from "../../../../../hooks/useSettings";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";

export function MediaPreviewAccountSettings() {
    const currentMediaPreview = useSettingValue("mediaPreviewConfig");

    const avatarOnChange = useCallback(
        (c: boolean) => {
            const newValue = {
                ...currentMediaPreview,
                // N.B. Switch is inverted. "Hide avatars..."
                invite_avatars: c ? MediaPreviewValue.Off : MediaPreviewValue.On,
            } satisfies MediaPreviewConfig;
            SettingsStore.setValue("mediaPreviewConfig", null, SettingLevel.ACCOUNT, newValue);
        },
        [currentMediaPreview],
    );

    const mediaPreviewOnChangeOff = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (event) => {
            if (!event.target.checked) {
                return;
            }
            SettingsStore.setValue("mediaPreviewConfig", null, SettingLevel.ACCOUNT, {
                ...currentMediaPreview,
                media_previews: MediaPreviewValue.Off,
            } satisfies MediaPreviewConfig);
        },
        [currentMediaPreview],
    );

    const mediaPreviewOnChangePrivate = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (event) => {
            if (!event.target.checked) {
                return;
            }
            SettingsStore.setValue("mediaPreviewConfig", null, SettingLevel.ACCOUNT, {
                ...currentMediaPreview,
                media_previews: MediaPreviewValue.Private,
            } satisfies MediaPreviewConfig);
        },
        [currentMediaPreview],
    );

    const mediaPreviewOnChangeOn = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (event) => {
            if (!event.target.checked) {
                return;
            }
            SettingsStore.setValue("mediaPreviewConfig", null, SettingLevel.ACCOUNT, {
                ...currentMediaPreview,
                media_previews: MediaPreviewValue.On,
            } satisfies MediaPreviewConfig);
        },
        [currentMediaPreview],
    );

    return (
        <Root>
            <LabelledToggleSwitch
                label={_t("settings|media_preview|hide_avatars")}
                value={currentMediaPreview.invite_avatars === MediaPreviewValue.Off}
                onChange={avatarOnChange}
            />
            <Field role="radiogroup" name="media_previews">
                <Label>{_t("settings|media_preview|media_preview_label")}</Label>
                <HelpMessage>{_t("settings|media_preview|media_preview_description")}</HelpMessage>
                <InlineField
                    name="media_preview_off"
                    control={
                        <RadioInput
                            checked={currentMediaPreview.media_previews === MediaPreviewValue.Off}
                            onChange={mediaPreviewOnChangeOff}
                        />
                    }
                >
                    <Label>{_t("settings|media_preview|hide_media")}</Label>
                </InlineField>
                <InlineField
                    name="media_preview_private"
                    control={
                        <RadioInput
                            checked={currentMediaPreview.media_previews === MediaPreviewValue.Private}
                            onChange={mediaPreviewOnChangePrivate}
                        />
                    }
                >
                    <Label>{_t("settings|media_preview|show_in_private")}</Label>
                </InlineField>
                <InlineField
                    name="media_preview_on"
                    control={
                        <RadioInput
                            checked={currentMediaPreview.media_previews === MediaPreviewValue.On}
                            onChange={mediaPreviewOnChangeOn}
                        />
                    }
                >
                    <Label>{_t("settings|media_preview|show_media")}</Label>
                </InlineField>
            </Field>
        </Root>
    );
}
