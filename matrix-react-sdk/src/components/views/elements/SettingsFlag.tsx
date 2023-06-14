/*
Copyright 2017 Travis Ralston
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import SettingsStore from "../../../settings/SettingsStore";
import { _t } from "../../../languageHandler";
import ToggleSwitch from "./ToggleSwitch";
import StyledCheckbox from "./StyledCheckbox";
import { SettingLevel } from "../../../settings/SettingLevel";
import { defaultWatchManager } from "../../../settings/Settings";

interface IProps {
    // The setting must be a boolean
    name: string;
    level: SettingLevel;
    roomId?: string; // for per-room settings
    label?: string; // untranslated
    isExplicit?: boolean;
    // XXX: once design replaces all toggles make this the default
    useCheckbox?: boolean;
    hideIfCannotSet?: boolean;
    onChange?(checked: boolean): void;
}

interface IState {
    value: boolean;
    /** true if `SettingsStore.isEnabled` returned false. */
    disabled: boolean;
}

export default class SettingsFlag extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            value: this.getSettingValue(),
            disabled: this.isSettingDisabled(),
        };
    }

    public componentDidMount(): void {
        defaultWatchManager.watchSetting(this.props.name, this.props.roomId ?? null, this.onSettingChange);
    }

    public componentWillUnmount(): void {
        defaultWatchManager.unwatchSetting(this.onSettingChange);
    }

    private getSettingValue(): boolean {
        return !!SettingsStore.getValueAt(
            this.props.level,
            this.props.name,
            this.props.roomId ?? null,
            this.props.isExplicit,
        );
    }

    private isSettingDisabled(): boolean {
        return !SettingsStore.isEnabled(this.props.name);
    }

    private onSettingChange = (): void => {
        this.setState({
            value: this.getSettingValue(),
            disabled: this.isSettingDisabled(),
        });
    };

    private onChange = async (checked: boolean): Promise<void> => {
        await this.save(checked);
        this.setState({ value: checked });
        this.props.onChange?.(checked);
    };

    private checkBoxOnChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.onChange(e.target.checked);
    };

    private save = async (val?: boolean): Promise<void> => {
        await SettingsStore.setValue(
            this.props.name,
            this.props.roomId ?? null,
            this.props.level,
            val !== undefined ? val : this.state.value,
        );
    };

    public render(): React.ReactNode {
        const canChange = SettingsStore.canSetValue(this.props.name, this.props.roomId ?? null, this.props.level);

        if (!canChange && this.props.hideIfCannotSet) return null;

        const label =
            (this.props.label
                ? _t(this.props.label)
                : SettingsStore.getDisplayName(this.props.name, this.props.level)) ?? undefined;
        const description = SettingsStore.getDescription(this.props.name);
        const shouldWarn = SettingsStore.shouldHaveWarning(this.props.name);
        const disabled = this.state.disabled || !canChange;

        if (this.props.useCheckbox) {
            return (
                <StyledCheckbox checked={this.state.value} onChange={this.checkBoxOnChange} disabled={disabled}>
                    {label}
                </StyledCheckbox>
            );
        } else {
            return (
                <div className="mx_SettingsFlag">
                    <label className="mx_SettingsFlag_label">
                        <span className="mx_SettingsFlag_labelText">{label}</span>
                        {description && (
                            <div className="mx_SettingsFlag_microcopy">
                                {shouldWarn
                                    ? _t(
                                          "<w>WARNING:</w> <description/>",
                                          {},
                                          {
                                              w: (sub) => (
                                                  <span className="mx_SettingsTab_microcopy_warning">{sub}</span>
                                              ),
                                              description,
                                          },
                                      )
                                    : description}
                            </div>
                        )}
                    </label>
                    <ToggleSwitch
                        checked={this.state.value}
                        onChange={this.onChange}
                        disabled={disabled}
                        tooltip={disabled ? SettingsStore.disabledMessage(this.props.name) : undefined}
                        title={label}
                    />
                </div>
            );
        }
    }
}
