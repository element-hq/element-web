/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.
Copyright 2019 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type ReactNode } from "react";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../../languageHandler";
import SdkConfig from "../../../../../SdkConfig";
import SettingsStore from "../../../../../settings/SettingsStore";
import SettingsFlag from "../../../elements/SettingsFlag";
import Field from "../../../elements/Field";
import AccessibleButton from "../../../elements/AccessibleButton";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { UIFeature } from "../../../../../settings/UIFeature";
import { LayoutSwitcher } from "../../LayoutSwitcher";
import FontScalingPanel from "../../FontScalingPanel";
import { ThemeChoicePanel } from "../../ThemeChoicePanel";
import ImageSizePanel from "../../ImageSizePanel";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection } from "../../shared/SettingsSubsection";

interface IState {
    useBundledEmojiFont: boolean;
    useSystemFont: boolean;
    systemFont: string;
    showAdvanced: boolean;
}

export default class AppearanceUserSettingsTab extends React.Component<EmptyObject, IState> {
    public constructor(props: EmptyObject) {
        super(props);

        this.state = {
            useBundledEmojiFont: SettingsStore.getValue("useBundledEmojiFont"),
            useSystemFont: SettingsStore.getValue("useSystemFont"),
            systemFont: SettingsStore.getValue("systemFont"),
            showAdvanced: false,
        };
    }

    private renderAdvancedSection(): ReactNode {
        if (!SettingsStore.getValue(UIFeature.AdvancedSettings)) return null;

        const brand = SdkConfig.get().brand;
        const toggle = (
            <AccessibleButton
                kind="link"
                onClick={() => this.setState({ showAdvanced: !this.state.showAdvanced })}
                aria-expanded={this.state.showAdvanced}
            >
                {this.state.showAdvanced ? _t("action|hide_advanced") : _t("action|show_advanced")}
            </AccessibleButton>
        );

        let advanced: React.ReactNode;

        if (this.state.showAdvanced) {
            const tooltipContent = _t("settings|appearance|custom_font_description", { brand });
            advanced = (
                <>
                    <SettingsFlag name="useCompactLayout" level={SettingLevel.DEVICE} useCheckbox={true} />

                    <SettingsFlag
                        name="useBundledEmojiFont"
                        level={SettingLevel.DEVICE}
                        useCheckbox={true}
                        onChange={(checked) => this.setState({ useBundledEmojiFont: checked })}
                    />
                    <SettingsFlag
                        name="useSystemFont"
                        level={SettingLevel.DEVICE}
                        useCheckbox={true}
                        onChange={(checked) => this.setState({ useSystemFont: checked })}
                    />
                    <Field
                        className="mx_AppearanceUserSettingsTab_checkboxControlledField"
                        label={SettingsStore.getDisplayName("systemFont")!}
                        onChange={(value: ChangeEvent<HTMLInputElement>) => {
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
                </>
            );
        }
        return (
            <SettingsSubsection>
                {toggle}
                {advanced}
            </SettingsSubsection>
        );
    }

    public render(): React.ReactNode {
        return (
            <SettingsTab data-testid="mx_AppearanceUserSettingsTab">
                <SettingsSection>
                    <ThemeChoicePanel />
                    <LayoutSwitcher />
                    <FontScalingPanel />
                    {this.renderAdvancedSection()}
                    <ImageSizePanel />
                </SettingsSection>
            </SettingsTab>
        );
    }
}
