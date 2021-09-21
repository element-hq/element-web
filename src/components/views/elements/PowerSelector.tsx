/*
Copyright 2015, 2016 OpenMarket Ltd

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
import * as Roles from '../../../Roles';
import { _t } from '../../../languageHandler';
import Field from "./Field";
import { Key } from "../../../Keyboard";
import { replaceableComponent } from "../../../utils/replaceableComponent";

const CUSTOM_VALUE = "SELECT_VALUE_CUSTOM";

interface IProps {
    value: number;
    // The maximum value that can be set with the power selector
    maxValue: number;

    // Default user power level for the room
    usersDefault: number;

    // should the user be able to change the value? false by default.
    disabled?: boolean;
    onChange?: (value: number, powerLevelKey: string) => void;

    // Optional key to pass as the second argument to `onChange`
    powerLevelKey?: string;

    // The name to annotate the selector with
    label?: string;
}

interface IState {
    levelRoleMap: {};
    // List of power levels to show in the drop-down
    options: number[];

    customValue: number;
    selectValue: number | string;
    custom?: boolean;
    customLevel?: number;
}

@replaceableComponent("views.elements.PowerSelector")
export default class PowerSelector extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        maxValue: Infinity,
        usersDefault: 0,
    };

    constructor(props: IProps) {
        super(props);

        this.state = {
            levelRoleMap: {},
            // List of power levels to show in the drop-down
            options: [],

            customValue: this.props.value,
            selectValue: 0,
        };
    }

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
    public UNSAFE_componentWillMount(): void {
        this.initStateFromProps(this.props);
    }

    // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
    public UNSAFE_componentWillReceiveProps(newProps: IProps): void {
        this.initStateFromProps(newProps);
    }

    private initStateFromProps(newProps: IProps): void {
        // This needs to be done now because levelRoleMap has translated strings
        const levelRoleMap = Roles.levelRoleMap(newProps.usersDefault);
        const options = Object.keys(levelRoleMap).filter(level => {
            return (
                level === undefined ||
                parseInt(level) <= newProps.maxValue ||
                parseInt(level) == newProps.value
            );
        }).map(level => parseInt(level));

        const isCustom = levelRoleMap[newProps.value] === undefined;

        this.setState({
            levelRoleMap,
            options,
            custom: isCustom,
            customLevel: newProps.value,
            selectValue: isCustom ? CUSTOM_VALUE : newProps.value,
        });
    }

    private onSelectChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
        const isCustom = event.target.value === CUSTOM_VALUE;
        if (isCustom) {
            this.setState({ custom: true });
        } else {
            const powerLevel = parseInt(event.target.value);
            this.props.onChange(powerLevel, this.props.powerLevelKey);
            this.setState({ selectValue: powerLevel });
        }
    };

    private onCustomChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ customValue: parseInt(event.target.value) });
    };

    private onCustomBlur = (event: React.FocusEvent): void => {
        event.preventDefault();
        event.stopPropagation();

        this.props.onChange(this.state.customValue, this.props.powerLevelKey);
    };

    private onCustomKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === Key.ENTER) {
            event.preventDefault();
            event.stopPropagation();

            // Do not call the onChange handler directly here - it can cause an infinite loop.
            // Long story short, a user hits Enter to submit the value which onChange handles as
            // raising a dialog which causes a blur which causes a dialog which causes a blur and
            // so on. By not causing the onChange to be called here, we avoid the loop because we
            // handle the onBlur safely.
            (event.target as HTMLInputElement).blur();
        }
    };

    public render(): JSX.Element {
        let picker;
        const label = typeof this.props.label === "undefined" ? _t("Power level") : this.props.label;
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
            options.push({ value: CUSTOM_VALUE, text: _t("Custom level") });
            const optionsElements = options.map((op) => {
                return <option value={op.value} key={op.value}>{ op.text }</option>;
            });

            picker = (
                <Field
                    element="select"
                    label={label}
                    onChange={this.onSelectChange}
                    value={String(this.state.selectValue)}
                    disabled={this.props.disabled}
                >
                    { optionsElements }
                </Field>
            );
        }

        return (
            <div className="mx_PowerSelector">
                { picker }
            </div>
        );
    }
}
