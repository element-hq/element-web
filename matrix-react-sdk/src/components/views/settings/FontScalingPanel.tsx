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

import React, { ChangeEvent } from "react";

import EventTilePreview from "../elements/EventTilePreview";
import Field from "../elements/Field";
import SettingsFlag from "../elements/SettingsFlag";
import SettingsStore from "../../../settings/SettingsStore";
import Slider from "../elements/Slider";
import { FontWatcher } from "../../../settings/watchers/FontWatcher";
import { IValidationResult, IFieldState } from "../elements/Validation";
import { Layout } from "../../../settings/enums/Layout";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { SettingLevel } from "../../../settings/SettingLevel";
import { _t } from "../../../languageHandler";
import { clamp } from "../../../utils/numbers";
import SettingsSubsection from "./shared/SettingsSubsection";

interface IProps {}

interface IState {
    // String displaying the current selected fontSize.
    // Needs to be string for things like '17.' without
    // trailing 0s.
    fontSize: string;
    useCustomFontSize: boolean;
    layout: Layout;
    // User profile data for the message preview
    userId?: string;
    displayName?: string;
    avatarUrl?: string;
}

export default class FontScalingPanel extends React.Component<IProps, IState> {
    private readonly MESSAGE_PREVIEW_TEXT = _t("Hey you. You're the best!");

    private unmounted = false;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            fontSize: (SettingsStore.getValue("baseFontSize", null) + FontWatcher.SIZE_DIFF).toString(),
            useCustomFontSize: SettingsStore.getValue("useCustomFontSize"),
            layout: SettingsStore.getValue("layout"),
        };
    }

    public async componentDidMount(): Promise<void> {
        // Fetch the current user profile for the message preview
        const client = MatrixClientPeg.get();
        const userId = client.getUserId()!;
        const profileInfo = await client.getProfileInfo(userId);
        if (this.unmounted) return;

        this.setState({
            userId,
            displayName: profileInfo.displayname,
            avatarUrl: profileInfo.avatar_url,
        });
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private onFontSizeChanged = (size: number): void => {
        this.setState({ fontSize: size.toString() });
        SettingsStore.setValue("baseFontSize", null, SettingLevel.DEVICE, size - FontWatcher.SIZE_DIFF);
    };

    private onValidateFontSize = async ({ value }: Pick<IFieldState, "value">): Promise<IValidationResult> => {
        const parsedSize = parseFloat(value!);
        const min = FontWatcher.MIN_SIZE + FontWatcher.SIZE_DIFF;
        const max = FontWatcher.MAX_SIZE + FontWatcher.SIZE_DIFF;

        if (isNaN(parsedSize)) {
            return { valid: false, feedback: _t("Size must be a number") };
        }

        if (!(min <= parsedSize && parsedSize <= max)) {
            return {
                valid: false,
                feedback: _t("Custom font size can only be between %(min)s pt and %(max)s pt", { min, max }),
            };
        }

        SettingsStore.setValue("baseFontSize", null, SettingLevel.DEVICE, parseInt(value!, 10) - FontWatcher.SIZE_DIFF);

        return { valid: true, feedback: _t("Use between %(min)s pt and %(max)s pt", { min, max }) };
    };

    public render(): React.ReactNode {
        const min = 13;
        const max = 18;

        return (
            <SettingsSubsection heading={_t("Font size")} stretchContent data-testid="mx_FontScalingPanel">
                <EventTilePreview
                    className="mx_FontScalingPanel_preview"
                    message={this.MESSAGE_PREVIEW_TEXT}
                    layout={this.state.layout}
                    userId={this.state.userId}
                    displayName={this.state.displayName}
                    avatarUrl={this.state.avatarUrl}
                />
                <div className="mx_FontScalingPanel_fontSlider">
                    <div className="mx_FontScalingPanel_fontSlider_smallText">Aa</div>
                    <Slider
                        min={min}
                        max={max}
                        step={1}
                        value={parseInt(this.state.fontSize, 10)}
                        onChange={this.onFontSizeChanged}
                        displayFunc={(_) => ""}
                        disabled={this.state.useCustomFontSize}
                        label={_t("Font size")}
                    />
                    <div className="mx_FontScalingPanel_fontSlider_largeText">Aa</div>
                </div>

                <SettingsFlag
                    name="useCustomFontSize"
                    level={SettingLevel.ACCOUNT}
                    onChange={(checked) => {
                        this.setState({ useCustomFontSize: checked });
                        if (!checked) {
                            const size = parseInt(this.state.fontSize, 10);
                            const clamped = clamp(size, min, max);
                            if (clamped !== size) {
                                this.onFontSizeChanged(clamped);
                            }
                        }
                    }}
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
                    onChange={(value: ChangeEvent<HTMLInputElement>) => this.setState({ fontSize: value.target.value })}
                    disabled={!this.state.useCustomFontSize}
                    className="mx_AppearanceUserSettingsTab_checkboxControlledField"
                />
            </SettingsSubsection>
        );
    }
}
