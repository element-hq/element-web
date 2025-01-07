/*
Copyright 2024 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import * as Roles from "../../../Roles";
import { _t } from "../../../languageHandler";
import Field from "./Field";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { objectHasDiff } from "../../../utils/objects";

const CUSTOM_VALUE = "SELECT_VALUE_CUSTOM";

interface Props<K extends undefined | string> {
    value: number;
    // The maximum value that can be set with the power selector
    maxValue: number;

    // Default user power level for the room
    usersDefault: number;

    // should the user be able to change the value? false by default.
    disabled?: boolean;

    // The name to annotate the selector with
    label?: string;

    onChange(value: number, powerLevelKey: K extends undefined ? void : K): void | Promise<void>;

    // Optional key to pass as the second argument to `onChange`
    powerLevelKey: K extends undefined ? void : K;
}

interface IState {
    levelRoleMap: Partial<Record<number | "undefined", string>>;
    // List of power levels to show in the drop-down
    options: number[];

    customValue: number;
    selectValue: number | string;
    custom?: boolean;
}

export default class PowerSelector<K extends undefined | string> extends React.Component<Props<K>, IState> {
    public static defaultProps: Partial<Props<any>> = {
        maxValue: Infinity,
        usersDefault: 0,
    };
    private unmounted = false;

    public constructor(props: Props<K>) {
        super(props);

        this.state = {
            levelRoleMap: {},
            // List of power levels to show in the drop-down
            options: [],

            customValue: this.props.value,
            selectValue: 0,
        };
    }

    public componentDidMount(): void {
        this.unmounted = false;
        this.initStateFromProps();
    }

    public componentDidUpdate(prevProps: Readonly<Props<K>>): void {
        if (objectHasDiff(this.props, prevProps)) {
            this.initStateFromProps();
        }
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private initStateFromProps(): void {
        // This needs to be done now because levelRoleMap has translated strings
        const levelRoleMap = Roles.levelRoleMap(this.props.usersDefault);
        const options = Object.keys(levelRoleMap)
            .filter((level) => {
                return (
                    level === undefined || parseInt(level) <= this.props.maxValue || parseInt(level) == this.props.value
                );
            })
            .map((level) => parseInt(level));

        const isCustom = levelRoleMap[this.props.value] === undefined;

        this.setState({
            levelRoleMap,
            options,
            custom: isCustom,
            customValue: this.props.value,
            selectValue: isCustom ? CUSTOM_VALUE : this.props.value,
        });
    }

    private onSelectChange = async (event: React.ChangeEvent<HTMLSelectElement>): Promise<void> => {
        const isCustom = event.target.value === CUSTOM_VALUE;
        if (isCustom) {
            this.setState({ custom: true });
        } else {
            const powerLevel = parseInt(event.target.value);
            this.setState({ selectValue: powerLevel });
            try {
                await this.props.onChange(powerLevel, this.props.powerLevelKey);
            } catch {
                if (this.unmounted) return;
                // If the request failed, roll back the state of the selector.
                this.initStateFromProps();
            }
        }
    };

    private onCustomChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ customValue: parseInt(event.target.value) });
    };

    private onCustomBlur = async (event: React.FocusEvent): Promise<void> => {
        event.preventDefault();
        event.stopPropagation();

        if (Number.isFinite(this.state.customValue)) {
            try {
                await this.props.onChange(this.state.customValue, this.props.powerLevelKey);
            } catch {
                if (this.unmounted) return;
                // If the request failed, roll back the state of the selector.
                this.initStateFromProps();
            }
        } else {
            this.initStateFromProps(); // reset, invalid input
        }
    };

    private onCustomKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(event);
        switch (action) {
            case KeyBindingAction.Enter:
                event.preventDefault();
                event.stopPropagation();

                // Do not call the onChange handler directly here - it can cause an infinite loop.
                // Long story short, a user hits Enter to submit the value which onChange handles as
                // raising a dialog which causes a blur which causes a dialog which causes a blur and
                // so on. By not causing the onChange to be called here, we avoid the loop because we
                // handle the onBlur safely.
                (event.target as HTMLInputElement).blur();
                break;
        }
    };

    public render(): React.ReactNode {
        let picker;
        const label = typeof this.props.label === "undefined" ? _t("power_level|label") : this.props.label;
        if (this.state.custom) {
            picker = (
                <Field
                    type="number"
                    label={label}
                    max={this.props.maxValue}
                    onBlur={this.onCustomBlur}
                    onKeyDown={this.onCustomKeyDown}
                    onChange={this.onCustomChange}
                    value={String(this.state.customValue)}
                    disabled={this.props.disabled}
                />
            );
        } else {
            // Each level must have a definition in this.state.levelRoleMap
            const options = this.state.options.map((level) => {
                return {
                    value: String(level),
                    text: Roles.textualPowerLevel(level, this.props.usersDefault),
                };
            });
            options.push({ value: CUSTOM_VALUE, text: _t("power_level|custom_level") });
            const optionsElements = options.map((op) => {
                return (
                    <option value={op.value} key={op.value} data-testid={`power-level-option-${op.value}`}>
                        {op.text}
                    </option>
                );
            });

            picker = (
                <Field
                    element="select"
                    label={label}
                    onChange={this.onSelectChange}
                    value={String(this.state.selectValue)}
                    disabled={this.props.disabled}
                    data-testid="power-level-select-element"
                >
                    {optionsElements}
                </Field>
            );
        }

        return <div className="mx_PowerSelector">{picker}</div>;
    }
}
