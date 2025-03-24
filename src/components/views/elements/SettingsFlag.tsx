/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2017 Travis Ralston

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import SettingsStore from "../../../settings/SettingsStore";
import { _t } from "../../../languageHandler";
import ToggleSwitch from "./ToggleSwitch";
import StyledCheckbox from "./StyledCheckbox";
import { type SettingLevel } from "../../../settings/SettingLevel";
import { type BooleanSettingKey, defaultWatchManager } from "../../../settings/Settings";

interface IProps {
    // The setting must be a boolean
    name: BooleanSettingKey;
    level: SettingLevel;
    roomId?: string; // for per-room settings
    label?: string;
    isExplicit?: boolean;
    // XXX: once design replaces all toggles make this the default
    useCheckbox?: boolean;
    hideIfCannotSet?: boolean;
    onChange?(checked: boolean): void;
}

interface IState {
    value: boolean;
}

export default class SettingsFlag extends React.Component<IProps, IState> {
    private readonly id = `mx_SettingsFlag_${secureRandomString(12)}`;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            value: this.getSettingValue(),
        };
    }

    public componentDidMount(): void {
        defaultWatchManager.watchSetting(this.props.name, this.props.roomId ?? null, this.onSettingChange);
    }

    public componentWillUnmount(): void {
        defaultWatchManager.unwatchSetting(this.onSettingChange);
    }

    private getSettingValue(): boolean {
        // If a level defined in props is overridden by a level at a high presedence, it gets disabled
        // and we should show the overridding value.
        if (
            SettingsStore.settingIsOveriddenAtConfigLevel(this.props.name, this.props.roomId ?? null, this.props.level)
        ) {
            return !!SettingsStore.getValue(this.props.name);
        }
        return !!SettingsStore.getValueAt(
            this.props.level,
            this.props.name,
            this.props.roomId ?? null,
            this.props.isExplicit,
        );
    }
    private onSettingChange = (): void => {
        this.setState({
            value: this.getSettingValue(),
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
        const disabled = !SettingsStore.canSetValue(this.props.name, this.props.roomId ?? null, this.props.level);

        if (disabled && this.props.hideIfCannotSet) return null;

        const label = this.props.label ?? SettingsStore.getDisplayName(this.props.name, this.props.level);
        const description = SettingsStore.getDescription(this.props.name);
        const shouldWarn = SettingsStore.shouldHaveWarning(this.props.name);

        if (this.props.useCheckbox) {
            return (
                <StyledCheckbox checked={this.state.value} onChange={this.checkBoxOnChange} disabled={disabled}>
                    {label}
                </StyledCheckbox>
            );
        } else {
            return (
                <div className="mx_SettingsFlag">
                    <label className="mx_SettingsFlag_label" htmlFor={this.id}>
                        <span className="mx_SettingsFlag_labelText">{label}</span>
                        {description && (
                            <div className="mx_SettingsFlag_microcopy">
                                {shouldWarn
                                    ? _t(
                                          "settings|warning",
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
                        id={this.id}
                        checked={this.state.value}
                        onChange={this.onChange}
                        disabled={disabled}
                        tooltip={disabled ? SettingsStore.disabledMessage(this.props.name) : undefined}
                        title={label ?? undefined}
                    />
                </div>
            );
        }
    }
}
