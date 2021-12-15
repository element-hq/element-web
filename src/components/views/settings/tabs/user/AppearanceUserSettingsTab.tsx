/*
Copyright 2019 New Vector Ltd
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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
import SdkConfig from "../../../../../SdkConfig";
import { MatrixClientPeg } from '../../../../../MatrixClientPeg';
import SettingsStore from "../../../../../settings/SettingsStore";
import StyledCheckbox from '../../../elements/StyledCheckbox';
import SettingsFlag from '../../../elements/SettingsFlag';
import Field from '../../../elements/Field';
import { SettingLevel } from "../../../../../settings/SettingLevel";
import { UIFeature } from "../../../../../settings/UIFeature";
import { Layout } from "../../../../../settings/enums/Layout";
import { replaceableComponent } from "../../../../../utils/replaceableComponent";
import LayoutSwitcher from "../../LayoutSwitcher";
import FontScalingPanel from '../../FontScalingPanel';
import ThemeChoicePanel from '../../ThemeChoicePanel';
import ImageSizePanel from "../../ImageSizePanel";

interface IProps {
}

interface IState {
    useSystemFont: boolean;
    systemFont: string;
    showAdvanced: boolean;
    layout: Layout;
    // User profile data for the message preview
    userId?: string;
    displayName: string;
    avatarUrl: string;
}

@replaceableComponent("views.settings.tabs.user.AppearanceUserSettingsTab")
export default class AppearanceUserSettingsTab extends React.Component<IProps, IState> {
    private readonly MESSAGE_PREVIEW_TEXT = _t("Hey you. You're the best!");

    private unmounted = false;

    constructor(props: IProps) {
        super(props);

        this.state = {
            useSystemFont: SettingsStore.getValue("useSystemFont"),
            systemFont: SettingsStore.getValue("systemFont"),
            showAdvanced: false,
            layout: SettingsStore.getValue("layout"),
            userId: null,
            displayName: null,
            avatarUrl: null,
        };
    }

    async componentDidMount() {
        // Fetch the current user profile for the message preview
        const client = MatrixClientPeg.get();
        const userId = client.getUserId();
        const profileInfo = await client.getProfileInfo(userId);
        if (this.unmounted) return;

        this.setState({
            userId,
            displayName: profileInfo.displayname,
            avatarUrl: profileInfo.avatar_url,
        });
    }

    componentWillUnmount() {
        this.unmounted = true;
    }

    private onLayoutChanged = (layout: Layout): void => {
        this.setState({ layout: layout });
    };

    private onIRCLayoutChange = (enabled: boolean) => {
        if (enabled) {
            this.setState({ layout: Layout.IRC });
            SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
        } else {
            this.setState({ layout: Layout.Group });
            SettingsStore.setValue("layout", null, SettingLevel.DEVICE, Layout.Group);
        }
    };

    private renderAdvancedSection() {
        if (!SettingsStore.getValue(UIFeature.AdvancedSettings)) return null;

        const brand = SdkConfig.get().brand;
        const toggle = <div
            className="mx_AppearanceUserSettingsTab_AdvancedToggle"
            onClick={() => this.setState({ showAdvanced: !this.state.showAdvanced })}
        >
            { this.state.showAdvanced ? _t("Hide advanced") : _t("Show advanced") }
        </div>;

        let advanced: React.ReactNode;

        if (this.state.showAdvanced) {
            const tooltipContent = _t(
                "Set the name of a font installed on your system & %(brand)s will attempt to use it.",
                { brand },
            );
            advanced = <>
                <SettingsFlag name="useCompactLayout" level={SettingLevel.DEVICE} useCheckbox={true} />

                { !SettingsStore.getValue("feature_new_layout_switcher") ?
                    <StyledCheckbox
                        checked={this.state.layout == Layout.IRC}
                        onChange={(ev) => this.onIRCLayoutChange(ev.target.checked)}
                    >
                        { _t("Enable experimental, compact IRC style layout") }
                    </StyledCheckbox> : null
                }

                <SettingsFlag
                    name="useSystemFont"
                    level={SettingLevel.DEVICE}
                    useCheckbox={true}
                    onChange={(checked) => this.setState({ useSystemFont: checked })}
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
            { toggle }
            { advanced }
        </div>;
    }

    render() {
        const brand = SdkConfig.get().brand;

        let layoutSection;
        if (SettingsStore.getValue("feature_new_layout_switcher")) {
            layoutSection = (
                <LayoutSwitcher
                    userId={this.state.userId}
                    displayName={this.state.displayName}
                    avatarUrl={this.state.avatarUrl}
                    messagePreviewText={this.MESSAGE_PREVIEW_TEXT}
                    onLayoutChanged={this.onLayoutChanged}
                />
            );
        }

        return (
            <div className="mx_SettingsTab mx_AppearanceUserSettingsTab">
                <div className="mx_SettingsTab_heading">{ _t("Customise your appearance") }</div>
                <div className="mx_SettingsTab_SubHeading">
                    { _t("Appearance Settings only affect this %(brand)s session.", { brand }) }
                </div>
                <ThemeChoicePanel />
                { layoutSection }
                <FontScalingPanel />
                { this.renderAdvancedSection() }
                <ImageSizePanel />
            </div>
        );
    }
}
