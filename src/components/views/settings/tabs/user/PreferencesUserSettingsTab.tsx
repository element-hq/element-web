/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement, useCallback, useEffect, useState } from "react";

import { type NonEmptyArray } from "../../../../../@types/common";
import { _t, getCurrentLanguage } from "../../../../../languageHandler";
import SettingsStore from "../../../../../settings/SettingsStore";
import Field from "../../../elements/Field";
import Dropdown from "../../../elements/Dropdown";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import SettingsFlag from "../../../elements/SettingsFlag";
import AccessibleButton from "../../../elements/AccessibleButton";
import dis from "../../../../../dispatcher/dispatcher";
import { UserTab } from "../../../dialogs/UserTab";
import { type OpenToTabPayload } from "../../../../../dispatcher/payloads/OpenToTabPayload";
import { Action } from "../../../../../dispatcher/actions";
import SdkConfig from "../../../../../SdkConfig";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import LanguageDropdown from "../../../elements/LanguageDropdown";
import PlatformPeg from "../../../../../PlatformPeg";
import { IS_MAC } from "../../../../../Keyboard";
import SpellCheckSettings from "../../SpellCheckSettings";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import * as TimezoneHandler from "../../../../../TimezoneHandler";
import { type BooleanSettingKey } from "../../../../../settings/Settings.tsx";

interface IProps {
    closeSettingsFn(success: boolean): void;
}

interface IState {
    timezone: string | undefined;
    timezones: string[];
    timezoneSearch: string | undefined;
    autocompleteDelay: string;
    readMarkerInViewThresholdMs: string;
    readMarkerOutOfViewThresholdMs: string;
}

const LanguageSection: React.FC = () => {
    const [language, setLanguage] = useState(getCurrentLanguage());

    const onLanguageChange = useCallback(
        (newLanguage: string) => {
            if (language === newLanguage) return;

            SettingsStore.setValue("language", null, SettingLevel.DEVICE, newLanguage);
            setLanguage(newLanguage);
            const platform = PlatformPeg.get();
            if (platform) {
                platform.setLanguage([newLanguage]);
                platform.reload();
            }
        },
        [language],
    );

    return (
        <div className="mx_SettingsSubsection_dropdown">
            {_t("settings|general|application_language")}
            <LanguageDropdown onOptionChange={onLanguageChange} value={language} />
            <div className="mx_PreferencesUserSettingsTab_section_hint">
                {_t("settings|general|application_language_reload_hint")}
            </div>
        </div>
    );
};

const SpellCheckSection: React.FC = () => {
    const [spellCheckEnabled, setSpellCheckEnabled] = useState<boolean | undefined>();
    const [spellCheckLanguages, setSpellCheckLanguages] = useState<string[] | undefined>();

    useEffect(() => {
        (async () => {
            const plaf = PlatformPeg.get();
            const [enabled, langs] = await Promise.all([plaf?.getSpellCheckEnabled(), plaf?.getSpellCheckLanguages()]);

            setSpellCheckEnabled(enabled);
            setSpellCheckLanguages(langs || undefined);
        })();
    }, []);

    const onSpellCheckEnabledChange = useCallback((enabled: boolean) => {
        setSpellCheckEnabled(enabled);
        PlatformPeg.get()?.setSpellCheckEnabled(enabled);
    }, []);

    const onSpellCheckLanguagesChange = useCallback((languages: string[]): void => {
        setSpellCheckLanguages(languages);
        PlatformPeg.get()?.setSpellCheckLanguages(languages);
    }, []);

    if (!PlatformPeg.get()?.supportsSpellCheckSettings()) return null;

    return (
        <>
            <LabelledToggleSwitch
                label={_t("settings|general|allow_spellcheck")}
                value={Boolean(spellCheckEnabled)}
                onChange={onSpellCheckEnabledChange}
            />
            {spellCheckEnabled && spellCheckLanguages !== undefined && !IS_MAC && (
                <SpellCheckSettings languages={spellCheckLanguages} onLanguagesChange={onSpellCheckLanguagesChange} />
            )}
        </>
    );
};

export default class PreferencesUserSettingsTab extends React.Component<IProps, IState> {
    private static ROOM_LIST_SETTINGS: BooleanSettingKey[] = ["breadcrumbs"];

    private static SPACES_SETTINGS: BooleanSettingKey[] = ["Spaces.allRoomsInHome"];

    private static KEYBINDINGS_SETTINGS: BooleanSettingKey[] = ["ctrlFForSearch"];

    private static PRESENCE_SETTINGS: BooleanSettingKey[] = ["sendReadReceipts", "sendTypingNotifications"];

    private static COMPOSER_SETTINGS: BooleanSettingKey[] = [
        "MessageComposerInput.autoReplaceEmoji",
        "MessageComposerInput.useMarkdown",
        "MessageComposerInput.suggestEmoji",
        "MessageComposerInput.ctrlEnterToSend",
        "MessageComposerInput.surroundWith",
        "MessageComposerInput.showStickersButton",
        "MessageComposerInput.insertTrailingColon",
    ];

    private static TIME_SETTINGS: BooleanSettingKey[] = ["showTwelveHourTimestamps", "alwaysShowTimestamps"];

    private static CODE_BLOCKS_SETTINGS: BooleanSettingKey[] = [
        "enableSyntaxHighlightLanguageDetection",
        "expandCodeByDefault",
        "showCodeLineNumbers",
    ];

    private static IMAGES_AND_VIDEOS_SETTINGS: BooleanSettingKey[] = [
        "urlPreviewsEnabled",
        "autoplayGifs",
        "autoplayVideo",
        "showImages",
    ];

    private static TIMELINE_SETTINGS: BooleanSettingKey[] = [
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

    private static ROOM_DIRECTORY_SETTINGS: BooleanSettingKey[] = ["SpotlightSearch.showNsfwPublicRooms"];

    private static GENERAL_SETTINGS: BooleanSettingKey[] = [
        "promptBeforeInviteUnknownUsers",
        // Start automatically after startup (electron-only)
        // Autocomplete delay (niche text box)
    ];

    public constructor(props: IProps) {
        super(props);

        this.state = {
            timezone: TimezoneHandler.getUserTimezone(),
            timezones: TimezoneHandler.getAllTimezones(),
            timezoneSearch: undefined,
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

    private onTimezoneChange = (tz: string): void => {
        this.setState({ timezone: tz });
        TimezoneHandler.setUserTimezone(tz);
    };

    /**
     * If present filter the time zones matching the search term
     */
    private onTimezoneSearchChange = (search: string): void => {
        const timezoneSearch = search.toLowerCase();
        const timezones = timezoneSearch
            ? TimezoneHandler.getAllTimezones().filter((tz) => {
                  return tz.toLowerCase().includes(timezoneSearch);
              })
            : TimezoneHandler.getAllTimezones();

        this.setState({ timezones, timezoneSearch });
    };

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

    private renderGroup(settingIds: BooleanSettingKey[], level = SettingLevel.ACCOUNT): React.ReactNodeArray {
        return settingIds.map((i) => <SettingsFlag key={i} name={i} level={level} />);
    }

    private onKeyboardShortcutsClicked = (): void => {
        dis.dispatch<OpenToTabPayload>({
            action: Action.ViewUserSettings,
            initialTabId: UserTab.Keyboard,
        });
    };

    public render(): React.ReactNode {
        const roomListSettings = PreferencesUserSettingsTab.ROOM_LIST_SETTINGS;

        const browserTimezoneLabel: string = _t("settings|preferences|default_timezone", {
            timezone: TimezoneHandler.shortBrowserTimezone(),
        });

        // Always Preprend the default option
        const timezones = this.state.timezones.map((tz) => {
            return <div key={tz}>{tz}</div>;
        });
        timezones.unshift(<div key="">{browserTimezoneLabel}</div>);

        return (
            <SettingsTab data-testid="mx_PreferencesUserSettingsTab">
                <SettingsSection>
                    {/* The heading string is still 'general' from where it was moved, but this section should become 'general' */}
                    <SettingsSubsection heading={_t("settings|general|language_section")}>
                        <LanguageSection />
                        <SpellCheckSection />
                    </SettingsSubsection>

                    {roomListSettings.length > 0 && (
                        <SettingsSubsection heading={_t("settings|preferences|room_list_heading")}>
                            {this.renderGroup(roomListSettings)}
                        </SettingsSubsection>
                    )}

                    <SettingsSubsection heading={_t("common|spaces")}>
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
                        <div className="mx_SettingsSubsection_dropdown">
                            {_t("settings|preferences|user_timezone")}
                            <Dropdown
                                id="mx_dropdownUserTimezone"
                                className="mx_dropdownUserTimezone"
                                data-testid="mx_dropdownUserTimezone"
                                searchEnabled={true}
                                value={this.state.timezone}
                                label={_t("settings|preferences|user_timezone")}
                                placeholder={browserTimezoneLabel}
                                onOptionChange={this.onTimezoneChange}
                                onSearchChange={this.onTimezoneSearchChange}
                            >
                                {timezones as NonEmptyArray<ReactElement & { key: string }>}
                            </Dropdown>
                        </div>

                        {this.renderGroup(PreferencesUserSettingsTab.TIME_SETTINGS)}
                        <SettingsFlag name="userTimezonePublish" level={SettingLevel.DEVICE} />
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

                    <SettingsSubsection heading={_t("common|general")} stretchContent>
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
