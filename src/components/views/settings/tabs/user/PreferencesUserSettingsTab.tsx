/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.
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

import React from 'react';

import { _t } from "../../../../../languageHandler";
import { UseCase } from "../../../../../settings/enums/UseCase";
import SettingsStore from "../../../../../settings/SettingsStore";
import Field from "../../../elements/Field";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SettingsFlag from '../../../elements/SettingsFlag';
import AccessibleButton from "../../../elements/AccessibleButton";
import dis from "../../../../../dispatcher/dispatcher";
import { UserTab } from "../../../dialogs/UserTab";
import { OpenToTabPayload } from "../../../../../dispatcher/payloads/OpenToTabPayload";
import { Action } from "../../../../../dispatcher/actions";
import SdkConfig from "../../../../../SdkConfig";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import { showUserOnboardingPage } from "../../../user-onboarding/UserOnboardingPage";

interface IProps {
    closeSettingsFn(success: boolean): void;
}

interface IState {
    disablingReadReceiptsSupported: boolean;
    autocompleteDelay: string;
    readMarkerInViewThresholdMs: string;
    readMarkerOutOfViewThresholdMs: string;
}

export default class PreferencesUserSettingsTab extends React.Component<IProps, IState> {
    private static ROOM_LIST_SETTINGS = [
        'breadcrumbs',
        "FTUE.userOnboardingButton",
    ];

    private static SPACES_SETTINGS = [
        "Spaces.allRoomsInHome",
    ];

    private static KEYBINDINGS_SETTINGS = [
        'ctrlFForSearch',
    ];

    private static PRESENCE_SETTINGS = [
        "sendTypingNotifications",
        // sendReadReceipts - handled specially due to server needing support
    ];

    private static COMPOSER_SETTINGS = [
        'MessageComposerInput.autoReplaceEmoji',
        'MessageComposerInput.useMarkdown',
        'MessageComposerInput.suggestEmoji',
        'MessageComposerInput.ctrlEnterToSend',
        'MessageComposerInput.surroundWith',
        'MessageComposerInput.showStickersButton',
        'MessageComposerInput.insertTrailingColon',
    ];

    private static TIME_SETTINGS = [
        'showTwelveHourTimestamps',
        'alwaysShowTimestamps',
    ];

    private static CODE_BLOCKS_SETTINGS = [
        'enableSyntaxHighlightLanguageDetection',
        'expandCodeByDefault',
        'showCodeLineNumbers',
    ];

    private static IMAGES_AND_VIDEOS_SETTINGS = [
        'urlPreviewsEnabled',
        'autoplayGifs',
        'autoplayVideo',
        'showImages',
    ];

    private static TIMELINE_SETTINGS = [
        'showTypingNotifications',
        'showRedactions',
        'showReadReceipts',
        'showJoinLeaves',
        'showDisplaynameChanges',
        'showChatEffects',
        'showAvatarChanges',
        'Pill.shouldShowPillAvatar',
        'TextualBody.enableBigEmoji',
        'scrollToBottomOnMessageSent',
        'useOnlyCurrentProfiles',
    ];

    private static GENERAL_SETTINGS = [
        'promptBeforeInviteUnknownUsers',
        // Start automatically after startup (electron-only)
        // Autocomplete delay (niche text box)
    ];

    constructor(props) {
        super(props);

        this.state = {
            disablingReadReceiptsSupported: false,
            autocompleteDelay:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'autocompleteDelay').toString(10),
            readMarkerInViewThresholdMs:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'readMarkerInViewThresholdMs').toString(10),
            readMarkerOutOfViewThresholdMs:
                SettingsStore.getValueAt(SettingLevel.DEVICE, 'readMarkerOutOfViewThresholdMs').toString(10),
        };
    }

    public async componentDidMount(): Promise<void> {
        this.setState({
            disablingReadReceiptsSupported: (
                await MatrixClientPeg.get().doesServerSupportUnstableFeature("org.matrix.msc2285.stable") ||
                await MatrixClientPeg.get().doesServerSupportUnstableFeature("org.matrix.msc2285")
            ),
        });
    }

    private onAutocompleteDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ autocompleteDelay: e.target.value });
        SettingsStore.setValue("autocompleteDelay", null, SettingLevel.DEVICE, e.target.value);
    };

    private onReadMarkerInViewThresholdMs = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ readMarkerInViewThresholdMs: e.target.value });
        SettingsStore.setValue("readMarkerInViewThresholdMs", null, SettingLevel.DEVICE, e.target.value);
    };

    private onReadMarkerOutOfViewThresholdMs = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ readMarkerOutOfViewThresholdMs: e.target.value });
        SettingsStore.setValue("readMarkerOutOfViewThresholdMs", null, SettingLevel.DEVICE, e.target.value);
    };

    private renderGroup(
        settingIds: string[],
        level = SettingLevel.ACCOUNT,
    ): React.ReactNodeArray {
        return settingIds.map(i => {
            const disabled = !SettingsStore.isEnabled(i);
            return <SettingsFlag key={i} name={i} level={level} disabled={disabled} />;
        });
    }

    private onKeyboardShortcutsClicked = (): void => {
        dis.dispatch<OpenToTabPayload>({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Keyboard,
        });
    };

    render() {
        const useCase = SettingsStore.getValue<UseCase | null>("FTUE.useCaseSelection");
        const roomListSettings = PreferencesUserSettingsTab.ROOM_LIST_SETTINGS
            // Only show the breadcrumbs setting if breadcrumbs v2 is disabled
            .filter(it => it !== "breadcrumbs" || !SettingsStore.getValue("feature_breadcrumbs_v2"))
            // Only show the user onboarding setting if the user should see the user onboarding page
            .filter(it => it !== "FTUE.userOnboardingButton" || showUserOnboardingPage(useCase));

        return (
            <div className="mx_SettingsTab mx_PreferencesUserSettingsTab">
                <div className="mx_SettingsTab_heading">{ _t("Preferences") }</div>

                { roomListSettings.length > 0 &&
                    <div className="mx_SettingsTab_section">
                        <span className="mx_SettingsTab_subheading">{ _t("Room list") }</span>
                        { this.renderGroup(roomListSettings) }
                    </div>
                }

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("Spaces") }</span>
                    { this.renderGroup(PreferencesUserSettingsTab.SPACES_SETTINGS, SettingLevel.ACCOUNT) }
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("Keyboard shortcuts") }</span>
                    <div className="mx_SettingsFlag">
                        { _t("To view all keyboard shortcuts, <a>click here</a>.", {}, {
                            a: sub => <AccessibleButton kind="link_inline" onClick={this.onKeyboardShortcutsClicked}>
                                { sub }
                            </AccessibleButton>,
                        }) }
                    </div>
                    { this.renderGroup(PreferencesUserSettingsTab.KEYBINDINGS_SETTINGS) }
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("Displaying time") }</span>
                    { this.renderGroup(PreferencesUserSettingsTab.TIME_SETTINGS) }
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("Presence") }</span>
                    <span className="mx_SettingsTab_subsectionText">
                        { _t("Share your activity and status with others.") }
                    </span>
                    <SettingsFlag
                        disabled={!this.state.disablingReadReceiptsSupported}
                        disabledDescription={_t("Your server doesn't support disabling sending read receipts.")}
                        name="sendReadReceipts"
                        level={SettingLevel.ACCOUNT}
                    />
                    { this.renderGroup(PreferencesUserSettingsTab.PRESENCE_SETTINGS) }
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("Composer") }</span>
                    { this.renderGroup(PreferencesUserSettingsTab.COMPOSER_SETTINGS) }
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("Code blocks") }</span>
                    { this.renderGroup(PreferencesUserSettingsTab.CODE_BLOCKS_SETTINGS) }
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("Images, GIFs and videos") }</span>
                    { this.renderGroup(PreferencesUserSettingsTab.IMAGES_AND_VIDEOS_SETTINGS) }
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("Timeline") }</span>
                    { this.renderGroup(PreferencesUserSettingsTab.TIMELINE_SETTINGS) }
                </div>

                <div className="mx_SettingsTab_section">
                    <span className="mx_SettingsTab_subheading">{ _t("General") }</span>
                    { this.renderGroup(PreferencesUserSettingsTab.GENERAL_SETTINGS) }

                    <SettingsFlag name="Electron.showTrayIcon" level={SettingLevel.PLATFORM} hideIfCannotSet />
                    <SettingsFlag
                        name="Electron.enableHardwareAcceleration"
                        level={SettingLevel.PLATFORM}
                        hideIfCannotSet
                        label={_t('Enable hardware acceleration (restart %(appName)s to take effect)', {
                            appName: SdkConfig.get().brand,
                        })}
                    />
                    <SettingsFlag name="Electron.alwaysShowMenuBar" level={SettingLevel.PLATFORM} hideIfCannotSet />
                    <SettingsFlag name="Electron.autoLaunch" level={SettingLevel.PLATFORM} hideIfCannotSet />
                    <SettingsFlag name="Electron.warnBeforeExit" level={SettingLevel.PLATFORM} hideIfCannotSet />

                    <Field
                        label={_t('Autocomplete delay (ms)')}
                        type='number'
                        value={this.state.autocompleteDelay}
                        onChange={this.onAutocompleteDelayChange} />
                    <Field
                        label={_t('Read Marker lifetime (ms)')}
                        type='number'
                        value={this.state.readMarkerInViewThresholdMs}
                        onChange={this.onReadMarkerInViewThresholdMs} />
                    <Field
                        label={_t('Read Marker off-screen lifetime (ms)')}
                        type='number'
                        value={this.state.readMarkerOutOfViewThresholdMs}
                        onChange={this.onReadMarkerOutOfViewThresholdMs} />
                </div>
            </div>
        );
    }
}
