/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { findHighContrastTheme, findNonHighContrastTheme, getOrderedThemes, isHighContrastTheme } from "../../../theme";
import ThemeWatcher from "../../../settings/watchers/ThemeWatcher";
import AccessibleButton from "../elements/AccessibleButton";
import dis from "../../../dispatcher/dispatcher";
import { RecheckThemePayload } from "../../../dispatcher/payloads/RecheckThemePayload";
import { Action } from "../../../dispatcher/actions";
import StyledCheckbox from "../elements/StyledCheckbox";
import Field from "../elements/Field";
import StyledRadioGroup from "../elements/StyledRadioGroup";
import { SettingLevel } from "../../../settings/SettingLevel";
import PosthogTrackers from "../../../PosthogTrackers";
import SettingsSubsection from "./shared/SettingsSubsection";

interface IProps {}

interface IThemeState {
    theme: string;
    useSystemTheme: boolean;
}

export interface CustomThemeMessage {
    isError: boolean;
    text: string;
}

interface IState extends IThemeState {
    customThemeUrl: string;
    customThemeMessage: CustomThemeMessage;
}

export default class ThemeChoicePanel extends React.Component<IProps, IState> {
    private themeTimer?: number;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            ...ThemeChoicePanel.calculateThemeState(),
            customThemeUrl: "",
            customThemeMessage: { isError: false, text: "" },
        };
    }

    public static calculateThemeState(): IThemeState {
        // We have to mirror the logic from ThemeWatcher.getEffectiveTheme so we
        // show the right values for things.

        const themeChoice: string = SettingsStore.getValue("theme");
        const systemThemeExplicit: boolean = SettingsStore.getValueAt(
            SettingLevel.DEVICE,
            "use_system_theme",
            null,
            false,
            true,
        );
        const themeExplicit: string = SettingsStore.getValueAt(SettingLevel.DEVICE, "theme", null, false, true);

        // If the user has enabled system theme matching, use that.
        if (systemThemeExplicit) {
            return {
                theme: themeChoice,
                useSystemTheme: true,
            };
        }

        // If the user has set a theme explicitly, use that (no system theme matching)
        if (themeExplicit) {
            return {
                theme: themeChoice,
                useSystemTheme: false,
            };
        }

        // Otherwise assume the defaults for the settings
        return {
            theme: themeChoice,
            useSystemTheme: SettingsStore.getValueAt(SettingLevel.DEVICE, "use_system_theme"),
        };
    }

    private onThemeChange = (newTheme: string): void => {
        if (this.state.theme === newTheme) return;

        PosthogTrackers.trackInteraction("WebSettingsAppearanceTabThemeSelector");

        // doing getValue in the .catch will still return the value we failed to set,
        // so remember what the value was before we tried to set it so we can revert
        const oldTheme: string = SettingsStore.getValue("theme");
        SettingsStore.setValue("theme", null, SettingLevel.DEVICE, newTheme).catch(() => {
            dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme });
            this.setState({ theme: oldTheme });
        });
        this.setState({ theme: newTheme });
        // The settings watcher doesn't fire until the echo comes back from the
        // server, so to make the theme change immediately we need to manually
        // do the dispatch now
        // XXX: The local echoed value appears to be unreliable, in particular
        // when settings custom themes(!) so adding forceTheme to override
        // the value from settings.
        dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme, forceTheme: newTheme });
    };

    private onUseSystemThemeChanged = (checked: boolean): void => {
        this.setState({ useSystemTheme: checked });
        SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, checked);
        dis.dispatch<RecheckThemePayload>({ action: Action.RecheckTheme });
    };

    private onAddCustomTheme = async (): Promise<void> => {
        let currentThemes: string[] = SettingsStore.getValue("custom_themes");
        if (!currentThemes) currentThemes = [];
        currentThemes = currentThemes.map((c) => c); // cheap clone

        if (this.themeTimer) {
            clearTimeout(this.themeTimer);
        }

        try {
            const r = await fetch(this.state.customThemeUrl);
            // XXX: need some schema for this
            const themeInfo = await r.json();
            if (!themeInfo || typeof themeInfo["name"] !== "string" || typeof themeInfo["colors"] !== "object") {
                this.setState({ customThemeMessage: { text: _t("Invalid theme schema."), isError: true } });
                return;
            }
            currentThemes.push(themeInfo);
        } catch (e) {
            logger.error(e);
            this.setState({ customThemeMessage: { text: _t("Error downloading theme information."), isError: true } });
            return; // Don't continue on error
        }

        await SettingsStore.setValue("custom_themes", null, SettingLevel.ACCOUNT, currentThemes);
        this.setState({ customThemeUrl: "", customThemeMessage: { text: _t("Theme added!"), isError: false } });

        this.themeTimer = window.setTimeout(() => {
            this.setState({ customThemeMessage: { text: "", isError: false } });
        }, 3000);
    };

    private onCustomThemeChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>): void => {
        this.setState({ customThemeUrl: e.target.value });
    };

    private renderHighContrastCheckbox(): React.ReactElement<HTMLDivElement> | undefined {
        if (
            !this.state.useSystemTheme &&
            (findHighContrastTheme(this.state.theme) || isHighContrastTheme(this.state.theme))
        ) {
            return (
                <div>
                    <StyledCheckbox
                        checked={isHighContrastTheme(this.state.theme)}
                        onChange={(e) => this.highContrastThemeChanged(e.target.checked)}
                    >
                        {_t("Use high contrast")}
                    </StyledCheckbox>
                </div>
            );
        }
    }

    private highContrastThemeChanged(checked: boolean): void {
        let newTheme: string | undefined;
        if (checked) {
            newTheme = findHighContrastTheme(this.state.theme);
        } else {
            newTheme = findNonHighContrastTheme(this.state.theme);
        }
        if (newTheme) {
            this.onThemeChange(newTheme);
        }
    }

    public render(): React.ReactElement<HTMLDivElement> {
        const themeWatcher = new ThemeWatcher();
        let systemThemeSection: JSX.Element | undefined;
        if (themeWatcher.isSystemThemeSupported()) {
            systemThemeSection = (
                <div data-testid="checkbox-use-system-theme">
                    <StyledCheckbox
                        checked={this.state.useSystemTheme}
                        onChange={(e) => this.onUseSystemThemeChanged(e.target.checked)}
                    >
                        {SettingsStore.getDisplayName("use_system_theme")}
                    </StyledCheckbox>
                </div>
            );
        }

        let customThemeForm: JSX.Element | undefined;
        if (SettingsStore.getValue("feature_custom_themes")) {
            let messageElement: JSX.Element | undefined;
            if (this.state.customThemeMessage.text) {
                if (this.state.customThemeMessage.isError) {
                    messageElement = <div className="text-error">{this.state.customThemeMessage.text}</div>;
                } else {
                    messageElement = <div className="text-success">{this.state.customThemeMessage.text}</div>;
                }
            }
            customThemeForm = (
                <div className="mx_SettingsTab_section">
                    <form onSubmit={this.onAddCustomTheme}>
                        <Field
                            label={_t("Custom theme URL")}
                            type="text"
                            id="mx_GeneralUserSettingsTab_customThemeInput"
                            autoComplete="off"
                            onChange={this.onCustomThemeChange}
                            value={this.state.customThemeUrl}
                        />
                        <AccessibleButton
                            onClick={this.onAddCustomTheme}
                            type="submit"
                            kind="primary_sm"
                            disabled={!this.state.customThemeUrl.trim()}
                        >
                            {_t("Add theme")}
                        </AccessibleButton>
                        {messageElement}
                    </form>
                </div>
            );
        }

        const orderedThemes = getOrderedThemes();
        return (
            <SettingsSubsection heading={_t("Theme")} data-testid="mx_ThemeChoicePanel">
                {systemThemeSection}
                <div className="mx_ThemeChoicePanel_themeSelectors" data-testid="theme-choice-panel-selectors">
                    <StyledRadioGroup
                        name="theme"
                        definitions={orderedThemes.map((t) => ({
                            value: t.id,
                            label: t.name,
                            disabled: this.state.useSystemTheme,
                            className: "mx_ThemeSelector_" + t.id,
                        }))}
                        onChange={this.onThemeChange}
                        value={this.apparentSelectedThemeId()}
                        outlined
                    />
                </div>
                {this.renderHighContrastCheckbox()}
                {customThemeForm}
            </SettingsSubsection>
        );
    }

    public apparentSelectedThemeId(): string | undefined {
        if (this.state.useSystemTheme) {
            return undefined;
        }
        const nonHighContrast = findNonHighContrastTheme(this.state.theme);
        return nonHighContrast ? nonHighContrast : this.state.theme;
    }
}
