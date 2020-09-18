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
import PropTypes from 'prop-types';
import * as Roles from '../../../Roles';
import { _t } from '../../../languageHandler';
import Field from "./Field";
import {Key} from "../../../Keyboard";

export default class PowerSelector extends React.Component {
    static propTypes = {
        value: PropTypes.number.isRequired,
        // The maximum value that can be set with the power selector
        maxValue: PropTypes.number.isRequired,

        // Default user power level for the room
        usersDefault: PropTypes.number.isRequired,

        // should the user be able to change the value? false by default.
        disabled: PropTypes.bool,
        onChange: PropTypes.func,

        // Optional key to pass as the second argument to `onChange`
        powerLevelKey: PropTypes.string,

        // The name to annotate the selector with
        label: PropTypes.string,
    }

    static defaultProps = {
        maxValue: Infinity,
        usersDefault: 0,
    };

    constructor(props) {
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
    // eslint-disable-next-line camelcase
    UNSAFE_componentWillMount() {
        this._initStateFromProps(this.props);
    }

    // eslint-disable-next-line camelcase
    UNSAFE_componentWillReceiveProps(newProps) {
        this._initStateFromProps(newProps);
    }

    _initStateFromProps(newProps) {
        // This needs to be done now because levelRoleMap has translated strings
        const levelRoleMap = Roles.levelRoleMap(newProps.usersDefault);
        const options = Object.keys(levelRoleMap).filter(level => {
            return (
                level === undefined ||
                level <= newProps.maxValue ||
                level == newProps.value
            );
        });

        const isCustom = levelRoleMap[newProps.value] === undefined;

        this.setState({
            levelRoleMap,
            options,
            custom: isCustom,
            customLevel: newProps.value,
            selectValue: isCustom ? "SELECT_VALUE_CUSTOM" : newProps.value,
        });
    }

    onSelectChange = event => {
        const isCustom = event.target.value === "SELECT_VALUE_CUSTOM";
        if (isCustom) {
            this.setState({custom: true});
        } else {
            this.props.onChange(event.target.value, this.props.powerLevelKey);
            this.setState({selectValue: event.target.value});
        }
    };

    onCustomChange = event => {
        this.setState({customValue: event.target.value});
    };

    onCustomBlur = event => {
        event.preventDefault();
        event.stopPropagation();

        this.props.onChange(parseInt(this.state.customValue), this.props.powerLevelKey);
    };

    onCustomKeyDown = event => {
        if (event.key === Key.ENTER) {
            event.preventDefault();
            event.stopPropagation();

            // Do not call the onChange handler directly here - it can cause an infinite loop.
            // Long story short, a user hits Enter to submit the value which onChange handles as
            // raising a dialog which causes a blur which causes a dialog which causes a blur and
            // so on. By not causing the onChange to be called here, we avoid the loop because we
            // handle the onBlur safely.
            event.target.blur();
        }
    };

    render() {
        let picker;
        const label = typeof this.props.label === "undefined" ? _t("Power level") : this.props.label;
        if (this.state.custom) {
            picker = (
                <Field type="number"
                       label={label} max={this.props.maxValue}
                       onBlur={this.onCustomBlur} onKeyDown={this.onCustomKeyDown} onChange={this.onCustomChange}
                       value={String(this.state.customValue)} disabled={this.props.disabled} />
            );
        } else {
            // Each level must have a definition in this.state.levelRoleMap
            let options = this.state.options.map((level) => {
                return {
                    value: level,
                    text: Roles.textualPowerLevel(level, this.props.usersDefault),
                };
            });
            options.push({ value: "SELECT_VALUE_CUSTOM", text: _t("Custom level") });
            options = options.map((op) => {
                return <option value={op.value} key={op.value}>{ op.text }</option>;
            });

            picker = (
                <Field element="select"
                       label={label} onChange={this.onSelectChange}
                       value={String(this.state.selectValue)} disabled={this.props.disabled}>
                    {options}
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
