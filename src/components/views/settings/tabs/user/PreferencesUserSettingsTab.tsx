/*
Copyright 2019-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";

import { _t } from "../../../../../languageHandler";
import { UseCase } from "../../../../../settings/enums/UseCase";
import SettingsStore from "../../../../../settings/SettingsStore";
import Field from "../../../elements/Field";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SettingsFlag from "../../../elements/SettingsFlag";
import AccessibleButton from "../../../elements/AccessibleButton";
import dis from "../../../../../dispatcher/dispatcher";
import { UserTab } from "../../../dialogs/UserTab";
import { OpenToTabPayload } from "../../../../../dispatcher/payloads/OpenToTabPayload";
import { Action } from "../../../../../dispatcher/actions";
import SdkConfig from "../../../../../SdkConfig";
import { showUserOnboardingPage } from "../../../user-onboarding/UserOnboardingPage";
import SettingsSubsection from "../../shared/SettingsSubsection";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";

interface IProps {
    closeSettingsFn(success: boolean): void;
}

interface IState {
    autocompleteDelay: string;
    readMarkerInViewThresholdMs: string;
    readMarkerOutOfViewThresholdMs: string;
}

export default class PreferencesUserSettingsTab extends React.Component<IProps, IState> {
    private static ROOM_LIST_SETTINGS = ["breadcrumbs", "FTUE.userOnboardingButton"];

    private static SPACES_SETTINGS = ["Spaces.allRoomsInHome"];

    private static KEYBINDINGS_SETTINGS = ["ctrlFForSearch"];

    private static PRESENCE_SETTINGS = ["sendReadReceipts", "sendTypingNotifications"];

    private static COMPOSER_SETTINGS = [
        "MessageComposerInput.autoReplaceEmoji",
        "MessageComposerInput.useMarkdown",
        "MessageComposerInput.suggestEmoji",
        "MessageComposerInput.ctrlEnterToSend",
        "MessageComposerInput.surroundWith",
        "MessageComposerInput.showStickersButton",
        "MessageComposerInput.insertTrailingColon",
    ];

    private static TIME_SETTINGS = ["showTwelveHourTimestamps", "alwaysShowTimestamps"];

    private static CODE_BLOCKS_SETTINGS = [
        "enableSyntaxHighlightLanguageDetection",
        "expandCodeByDefault",
        "showCodeLineNumbers",
    ];

    private static IMAGES_AND_VIDEOS_SETTINGS = ["urlPreviewsEnabled", "autoplayGifs", "autoplayVideo", "showImages"];

    private static TIMELINE_SETTINGS = [
        "showTypingNotifications",
        "showRedactions",
        "showReadReceipts",
        "showJoinLeaves",
        "showDisplaynameChanges",
        "showChatEffects",
        "showAvatarChanges",
        "Pill.shouldShowPillAvatar",
        "TextualBody.enableBigEmoji",
        "scrollToBottomOnMessageSent",
        "useOnlyCurrentProfiles",
    ];

    private static ROOM_DIRECTORY_SETTINGS = ["SpotlightSearch.showNsfwPublicRooms"];

    private static GENERAL_SETTINGS = [
        "promptBeforeInviteUnknownUsers",
        // Start automatically after startup (electron-only)
        // Autocomplete delay (niche text box)
    ];

    public constructor(props: IProps) {
        super(props);

        this.state = {
            autocompleteDelay: SettingsStore.getValueAt(SettingLevel.DEVICE, "autocompleteDelay").toString(10),
            readMarkerInViewThresholdMs: SettingsStore.getValueAt(
                SettingLevel.DEVICE,
                "readMarkerInViewThresholdMs",
            ).toString(10),
            readMarkerOutOfViewThresholdMs: SettingsStore.getValueAt(
                SettingLevel.DEVICE,
                "readMarkerOutOfViewThresholdMs",
            ).toString(10),
        };
    }

    private onAutocompleteDelayChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ autocompleteDelay: e.target.value });
        SettingsStore.setValue("autocompleteDelay", null, SettingLevel.DEVICE, e.target.value);
    };

    private onReadMarkerInViewThresholdMs = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ readMarkerInViewThresholdMs: e.target.value });
        SettingsStore.setValue("readMarkerInViewThresholdMs", null, SettingLevel.DEVICE, e.target.value);
    };

    private onReadMarkerOutOfViewThresholdMs = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ readMarkerOutOfViewThresholdMs: e.target.value });
        SettingsStore.setValue("readMarkerOutOfViewThresholdMs", null, SettingLevel.DEVICE, e.target.value);
    };

    private renderGroup(settingIds: string[], level = SettingLevel.ACCOUNT): React.ReactNodeArray {
        return settingIds.map((i) => <SettingsFlag key={i} name={i} level={level} />);
    }

    private onKeyboardShortcutsClicked = (): void => {
        dis.dispatch<OpenToTabPayload>({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Keyboard,
        });
    };

    public render(): React.ReactNode {
        const useCase = SettingsStore.getValue<UseCase | null>("FTUE.useCaseSelection");
        const roomListSettings = PreferencesUserSettingsTab.ROOM_LIST_SETTINGS
            // Only show the user onboarding setting if the user should see the user onboarding page
            .filter((it) => it !== "FTUE.userOnboardingButton" || showUserOnboardingPage(useCase));

        return (
            <SettingsTab data-testid="mx_PreferencesUserSettingsTab">
                <SettingsSection heading={_t("common|preferences")}>
                    {roomListSettings.length > 0 && (
                        <SettingsSubsection heading={_t("settings|preferences|room_list_heading")}>
                            {this.renderGroup(roomListSettings)}
                        </SettingsSubsection>
                    )}

                    <SettingsSubsection heading={_t("Spaces")}>
                        {this.renderGroup(PreferencesUserSettingsTab.SPACES_SETTINGS, SettingLevel.ACCOUNT)}
                    </SettingsSubsection>

                    <SettingsSubsection
                        heading={_t("settings|preferences|keyboard_heading")}
                        description={_t(
                            "settings|preferences|keyboard_view_shortcuts_button",
                            {},
                            {
                                a: (sub) => (
                                    <AccessibleButton kind="link_inline" onClick={this.onKeyboardShortcutsClicked}>
                                        {sub}
                                    </AccessibleButton>
                                ),
                            },
                        )}
                    >
                        {this.renderGroup(PreferencesUserSettingsTab.KEYBINDINGS_SETTINGS)}
                    </SettingsSubsection>

                    <SettingsSubsection heading={_t("settings|preferences|time_heading")}>
                        {this.renderGroup(PreferencesUserSettingsTab.TIME_SETTINGS)}
                    </SettingsSubsection>

                    <SettingsSubsection
                        heading={_t("common|presence")}
                        description={_t("settings|preferences|presence_description")}
                    >
                        {this.renderGroup(PreferencesUserSettingsTab.PRESENCE_SETTINGS)}
                    </SettingsSubsection>

                    <SettingsSubsection heading={_t("settings|preferences|composer_heading")}>
                        {this.renderGroup(PreferencesUserSettingsTab.COMPOSER_SETTINGS)}
                    </SettingsSubsection>

                    <SettingsSubsection heading={_t("settings|preferences|code_blocks_heading")}>
                        {this.renderGroup(PreferencesUserSettingsTab.CODE_BLOCKS_SETTINGS)}
                    </SettingsSubsection>

                    <SettingsSubsection heading={_t("settings|preferences|media_heading")}>
                        {this.renderGroup(PreferencesUserSettingsTab.IMAGES_AND_VIDEOS_SETTINGS)}
                    </SettingsSubsection>

                    <SettingsSubsection heading={_t("common|timeline")}>
                        {this.renderGroup(PreferencesUserSettingsTab.TIMELINE_SETTINGS)}
                    </SettingsSubsection>

                    <SettingsSubsection heading={_t("settings|preferences|room_directory_heading")}>
                        {this.renderGroup(PreferencesUserSettingsTab.ROOM_DIRECTORY_SETTINGS)}
                    </SettingsSubsection>

                    <SettingsSubsection heading={_t("General")} stretchContent>
                        {this.renderGroup(PreferencesUserSettingsTab.GENERAL_SETTINGS)}

                        <SettingsFlag name="Electron.showTrayIcon" level={SettingLevel.PLATFORM} hideIfCannotSet />
                        <SettingsFlag
                            name="Electron.enableHardwareAcceleration"
                            level={SettingLevel.PLATFORM}
                            hideIfCannotSet
                            label={_t("settings|preferences|Electron.enableHardwareAcceleration", {
                                appName: SdkConfig.get().brand,
                            })}
                        />
                        <SettingsFlag name="Electron.alwaysShowMenuBar" level={SettingLevel.PLATFORM} hideIfCannotSet />
                        <SettingsFlag name="Electron.autoLaunch" level={SettingLevel.PLATFORM} hideIfCannotSet />
                        <SettingsFlag name="Electron.warnBeforeExit" level={SettingLevel.PLATFORM} hideIfCannotSet />

                        <Field
                            label={_t("settings|preferences|autocomplete_delay")}
                            type="number"
                            value={this.state.autocompleteDelay}
                            onChange={this.onAutocompleteDelayChange}
                        />
                        <Field
                            label={_t("settings|preferences|rm_lifetime")}
                            type="number"
                            value={this.state.readMarkerInViewThresholdMs}
                            onChange={this.onReadMarkerInViewThresholdMs}
                        />
                        <Field
                            label={_t("settings|preferences|rm_lifetime_offscreen")}
                            type="number"
                            value={this.state.readMarkerOutOfViewThresholdMs}
                            onChange={this.onReadMarkerOutOfViewThresholdMs}
                        />
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}
