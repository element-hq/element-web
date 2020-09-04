/*
Copyright 2019 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import {_t} from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import SettingsStore from "../../../../../settings/SettingsStore";
import { enumerateThemes } from "../../../../../theme";
import ThemeWatcher from "../../../../../settings/watchers/ThemeWatcher";
import Slider from "../../../elements/Slider";
import AccessibleButton from "../../../elements/AccessibleButton";
import dis from "../../../../../dispatcher/dispatcher";
import { FontWatcher } from "../../../../../settings/watchers/FontWatcher";
import { RecheckThemePayload } from '../../../../../dispatcher/payloads/RecheckThemePayload';
import { Action } from '../../../../../dispatcher/actions';
import { IValidationResult, IFieldState } from '../../../elements/Validation';
import StyledRadioButton from '../../../elements/StyledRadioButton';
import StyledCheckbox from '../../../elements/StyledCheckbox';
import SettingsFlag from '../../../elements/SettingsFlag';
import Field from '../../../elements/Field';
import EventTilePreview from '../../../elements/EventTilePreview';
import StyledRadioGroup from "../../../elements/StyledRadioGroup";
import classNames from 'classnames';
import { SettingLevel } from "../../../../../settings/SettingLevel";

interface IProps {
}

interface IThemeState {
    theme: string;
    useSystemTheme: boolean;
}

export interface CustomThemeMessage {
    isError: boolean;
    text: string;
}

interface IState extends IThemeState {
    // String displaying the current selected fontSize.
    // Needs to be string for things like '17.' without
    // trailing 0s.
    fontSize: string;
    customThemeUrl: string;
    customThemeMessage: CustomThemeMessage;
    useCustomFontSize: boolean;
    useSystemFont: boolean;
    systemFont: string;
    showAdvanced: boolean;
    useIRCLayout: boolean;
}


export default class AppearanceUserSettingsTab extends React.Component<IProps, IState> {
    private readonly MESSAGE_PREVIEW_TEXT = _t("Hey you. You're the best!");

    private themeTimer: NodeJS.Timeout;

    constructor(props: IProps) {
        super(props);

        this.state = {
            fontSize: (SettingsStore.getValue("baseFontSize", null) + FontWatcher.SIZE_DIFF).toString(),
            ...this.calculateThemeState(),
            customThemeUrl: "",
            customThemeMessage: {isError: false, text: ""},
            useCustomFontSize: SettingsStore.getValue("useCustomFontSize"),
            useSystemFont: SettingsStore.getValue("useSystemFont"),
            systemFont: SettingsStore.getValue("systemFont"),
            showAdvanced: false,
            useIRCLayout: SettingsStore.getValue("useIRCLayout"),
        };
    }

    private calculateThemeState(): IThemeState {
        // We have to mirror the logic from ThemeWatcher.getEffectiveTheme so we
        // show the right values for things.

        const themeChoice: string = SettingsStore.getValue("theme");
        const systemThemeExplicit: boolean = SettingsStore.getValueAt(
            SettingLevel.DEVICE, "use_system_theme", null, false, true);
        const themeExplicit: string = SettingsStore.getValueAt(
            SettingLevel.DEVICE, "theme", null, false, true);

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

        // doing getValue in the .catch will still return the value we failed to set,
        // so remember what the value was before we tried to set it so we can revert
        const oldTheme: string = SettingsStore.getValue('theme');
        SettingsStore.setValue("theme", null, SettingLevel.DEVICE, newTheme).catch(() => {
            dis.dispatch<RecheckThemePayload>({action: Action.RecheckTheme});
            this.setState({theme: oldTheme});
        });
        this.setState({theme: newTheme});
        // The settings watcher doesn't fire until the echo comes back from the
        // server, so to make the theme change immediately we need to manually
        // do the dispatch now
        // XXX: The local echoed value appears to be unreliable, in particular
        // when settings custom themes(!) so adding forceTheme to override
        // the value from settings.
        dis.dispatch<RecheckThemePayload>({action: Action.RecheckTheme, forceTheme: newTheme});
    };

    private onUseSystemThemeChanged = (checked: boolean): void => {
        this.setState({useSystemTheme: checked});
        SettingsStore.setValue("use_system_theme", null, SettingLevel.DEVICE, checked);
        dis.dispatch<RecheckThemePayload>({action: Action.RecheckTheme});
    };

    private onFontSizeChanged = (size: number): void => {
        this.setState({fontSize: size.toString()});
        SettingsStore.setValue("baseFontSize", null, SettingLevel.DEVICE, size - FontWatcher.SIZE_DIFF);
    };

    private onValidateFontSize = async ({value}: Pick<IFieldState, "value">): Promise<IValidationResult> => {
        const parsedSize = parseFloat(value);
        const min = FontWatcher.MIN_SIZE + FontWatcher.SIZE_DIFF;
        const max = FontWatcher.MAX_SIZE + FontWatcher.SIZE_DIFF;

        if (isNaN(parsedSize)) {
            return {valid: false, feedback: _t("Size must be a number")};
        }

        if (!(min <= parsedSize && parsedSize <= max)) {
            return {
                valid: false,
                feedback: _t('Custom font size can only be between %(min)s pt and %(max)s pt', {min, max}),
            };
        }

        SettingsStore.setValue(
            "baseFontSize",
            null,
            SettingLevel.DEVICE,
            parseInt(value, 10) - FontWatcher.SIZE_DIFF,
        );

        return {valid: true, feedback: _t('Use between %(min)s pt and %(max)s pt', {min, max})};
    };

    private onAddCustomTheme = async (): Promise<void> => {
        let currentThemes: string[] = SettingsStore.getValue("custom_themes");
        if (!currentThemes) currentThemes = [];
        currentThemes = currentThemes.map(c => c); // cheap clone

        if (this.themeTimer) {
            clearTimeout(this.themeTimer);
        }

        try {
            const r = await fetch(this.state.customThemeUrl);
            // XXX: need some schema for this
            const themeInfo = await r.json();
            if (!themeInfo || typeof(themeInfo['name']) !== 'string' || typeof(themeInfo['colors']) !== 'object') {
                this.setState({customThemeMessage: {text: _t("Invalid theme schema."), isError: true}});
                return;
            }
            currentThemes.push(themeInfo);
        } catch (e) {
            console.error(e);
            this.setState({customThemeMessage: {text: _t("Error downloading theme information."), isError: true}});
            return; // Don't continue on error
        }

        await SettingsStore.setValue("custom_themes", null, SettingLevel.ACCOUNT, currentThemes);
        this.setState({customThemeUrl: "", customThemeMessage: {text: _t("Theme added!"), isError: false}});

        this.themeTimer = setTimeout(() => {
            this.setState({customThemeMessage: {text: "", isError: false}});
        }, 3000);
    };

    private onCustomThemeChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>): void => {
        this.setState({customThemeUrl: e.target.value});
    };

    private onLayoutChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const val = e.target.value === "true";

        this.setState({
            useIRCLayout: val,
        });

        SettingsStore.setValue("useIRCLayout", null, SettingLevel.DEVICE, val);
    };

    private renderThemeSection() {
        const themeWatcher = new ThemeWatcher();
        let systemThemeSection: JSX.Element;
        if (themeWatcher.isSystemThemeSupported()) {
            systemThemeSection = <div>
                <StyledCheckbox
                    checked={this.state.useSystemTheme}
                    onChange={(e) => this.onUseSystemThemeChanged(e.target.checked)}
                >
                    {SettingsStore.getDisplayName("use_system_theme")}
                </StyledCheckbox>
            </div>;
        }

        let customThemeForm: JSX.Element;
        if (SettingsStore.getValue("feature_custom_themes")) {
            let messageElement = null;
            if (this.state.customThemeMessage.text) {
                if (this.state.customThemeMessage.isError) {
                    messageElement = <div className='text-error'>{this.state.customThemeMessage.text}</div>;
                } else {
                    messageElement = <div className='text-success'>{this.state.customThemeMessage.text}</div>;
                }
            }
            customThemeForm = (
                <div className='mx_SettingsTab_section'>
                    <form onSubmit={this.onAddCustomTheme}>
                        <Field
                            label={_t("Custom theme URL")}
                            type='text'
                            id='mx_GeneralUserSettingsTab_customThemeInput'
                            autoComplete="off"
                            onChange={this.onCustomThemeChange}
                            value={this.state.customThemeUrl}
                        />
                        <AccessibleButton
                            onClick={this.onAddCustomTheme}
                            type="submit" kind="primary_sm"
                            disabled={!this.state.customThemeUrl.trim()}
                        >{_t("Add theme")}</AccessibleButton>
                        {messageElement}
                    </form>
                </div>
            );
        }

        // XXX: replace any type here
        const themes = Object.entries<any>(enumerateThemes())
            .map(p => ({id: p[0], name: p[1]})); // convert pairs to objects for code readability
        const builtInThemes = themes.filter(p => !p.id.startsWith("custom-"));
        const customThemes = themes.filter(p => !builtInThemes.includes(p))
            .sort((a, b) => a.name.localeCompare(b.name));
        const orderedThemes = [...builtInThemes, ...customThemes];
        return (
            <div className="mx_SettingsTab_section mx_AppearanceUserSettingsTab_themeSection">
                <span className="mx_SettingsTab_subheading">{_t("Theme")}</span>
                {systemThemeSection}
                <div className="mx_ThemeSelectors">
                    <StyledRadioGroup
                        name="theme"
                        definitions={orderedThemes.map(t => ({
                            value: t.id,
                            label: t.name,
                            disabled: this.state.useSystemTheme,
                            className: "mx_ThemeSelector_" + t.id,
                        }))}
                        onChange={this.onThemeChange}
                        value={this.state.useSystemTheme ? undefined : this.state.theme}
                        outlined
                    />
                </div>
                {customThemeForm}
            </div>
        );
    }

    private renderFontSection() {
        return <div className="mx_SettingsTab_section mx_AppearanceUserSettingsTab_fontScaling">

            <span className="mx_SettingsTab_subheading">{_t("Font size")}</span>
            <EventTilePreview
                className="mx_AppearanceUserSettingsTab_fontSlider_preview"
                message={this.MESSAGE_PREVIEW_TEXT}
                useIRCLayout={this.state.useIRCLayout}
            />
            <div className="mx_AppearanceUserSettingsTab_fontSlider">
                <div className="mx_AppearanceUserSettingsTab_fontSlider_smallText">Aa</div>
                <Slider
                    values={[13, 14, 15, 16, 18]}
                    value={parseInt(this.state.fontSize, 10)}
                    onSelectionChange={this.onFontSizeChanged}
                    displayFunc={_ => ""}
                    disabled={this.state.useCustomFontSize}
                />
                <div className="mx_AppearanceUserSettingsTab_fontSlider_largeText">Aa</div>
            </div>

            <SettingsFlag
                name="useCustomFontSize"
                level={SettingLevel.ACCOUNT}
                onChange={(checked) => this.setState({useCustomFontSize: checked})}
                useCheckbox={true}
            />

            <Field
                type="number"
                label={_t("Font size")}
                autoComplete="off"
                placeholder={this.state.fontSize.toString()}
                value={this.state.fontSize.toString()}
                id="font_size_field"
                onValidate={this.onValidateFontSize}
                onChange={(value) => this.setState({fontSize: value.target.value})}
                disabled={!this.state.useCustomFontSize}
                className="mx_SettingsTab_customFontSizeField"
            />
        </div>;
    }

    private renderLayoutSection = () => {
        return <div className="mx_SettingsTab_section mx_AppearanceUserSettingsTab_Layout">
            <span className="mx_SettingsTab_subheading">{_t("Message layout")}</span>

            <div className="mx_AppearanceUserSettingsTab_Layout_RadioButtons">
                <div className={classNames("mx_AppearanceUserSettingsTab_Layout_RadioButton", {
                    mx_AppearanceUserSettingsTab_Layout_RadioButton_selected: this.state.useIRCLayout,
                })}>
                    <EventTilePreview
                        className="mx_AppearanceUserSettingsTab_Layout_RadioButton_preview"
                        message={this.MESSAGE_PREVIEW_TEXT}
                        useIRCLayout={true}
                    />
                    <StyledRadioButton
                        name="layout"
                        value="true"
                        checked={this.state.useIRCLayout}
                        onChange={this.onLayoutChange}
                    >
                        {_t("Compact")}
                    </StyledRadioButton>
                </div>
                <div className="mx_AppearanceUserSettingsTab_spacer" />
                <div className={classNames("mx_AppearanceUserSettingsTab_Layout_RadioButton", {
                    mx_AppearanceUserSettingsTab_Layout_RadioButton_selected: !this.state.useIRCLayout,
                })}>
                    <EventTilePreview
                        className="mx_AppearanceUserSettingsTab_Layout_RadioButton_preview"
                        message={this.MESSAGE_PREVIEW_TEXT}
                        useIRCLayout={false}
                    />
                    <StyledRadioButton
                        name="layout"
                        value="false"
                        checked={!this.state.useIRCLayout}
                        onChange={this.onLayoutChange}
                    >
                        {_t("Modern")}
                    </StyledRadioButton>
                </div>
            </div>
        </div>;
    };

    private renderAdvancedSection() {
        const brand = SdkConfig.get().brand;
        const toggle = <div
            className="mx_AppearanceUserSettingsTab_AdvancedToggle"
            onClick={() => this.setState({showAdvanced: !this.state.showAdvanced})}
        >
            {this.state.showAdvanced ? "Hide advanced" : "Show advanced"}
        </div>;

        let advanced: React.ReactNode;

        if (this.state.showAdvanced) {
            const tooltipContent = _t(
                "Set the name of a font installed on your system & %(brand)s will attempt to use it.",
                { brand },
            );
            advanced = <>
                <SettingsFlag
                    name="useCompactLayout"
                    level={SettingLevel.DEVICE}
                    useCheckbox={true}
                    disabled={this.state.useIRCLayout}
                />
                <SettingsFlag
                    name="useIRCLayout"
                    level={SettingLevel.DEVICE}
                    useCheckbox={true}
                    onChange={(checked) => this.setState({useIRCLayout: checked})}
                />
                <SettingsFlag
                    name="useSystemFont"
                    level={SettingLevel.DEVICE}
                    useCheckbox={true}
                    onChange={(checked) => this.setState({useSystemFont: checked})}
                />
                <Field
                    className="mx_AppearanceUserSettingsTab_systemFont"
                    label={SettingsStore.getDisplayName("systemFont")}
                    onChange={(value) => {
                        this.setState({
                            systemFont: value.target.value,
                        });

                        SettingsStore.setValue("systemFont", null, SettingLevel.DEVICE, value.target.value);
                    }}
                    tooltipContent={tooltipContent}
                    forceTooltipVisible={true}
                    disabled={!this.state.useSystemFont}
                    value={this.state.systemFont}
                />
            </>;
        }
        return <div className="mx_SettingsTab_section mx_AppearanceUserSettingsTab_Advanced">
            {toggle}
            {advanced}
        </div>;
    }

    render() {
        const brand = SdkConfig.get().brand;

        return (
            <div className="mx_SettingsTab mx_AppearanceUserSettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Customise your appearance")}</div>
                <div className="mx_SettingsTab_SubHeading">
                    {_t("Appearance Settings only affect this %(brand)s session.", { brand })}
                </div>
                {this.renderThemeSection()}
                {this.renderFontSection()}
                {this.renderAdvancedSection()}
            </div>
        );
    }
}
