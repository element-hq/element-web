/*
Copyright 2017 Travis Ralston

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
import PropTypes from 'prop-types';
import SettingsStore from "../../../settings/SettingsStore";
import { _t } from '../../../languageHandler';

module.exports = React.createClass({
    displayName: 'SettingsFlag',
    propTypes: {
        name: PropTypes.string.isRequired,
        level: PropTypes.string.isRequired,
        roomId: PropTypes.string, // for per-room settings
        label: PropTypes.string, // untranslated
        onChange: PropTypes.func,
        isExplicit: PropTypes.bool,
        manualSave: PropTypes.bool,

        // If group is supplied, then this will create a radio button instead.
        group: PropTypes.string,
        value: PropTypes.any, // the value for the radio button
    },

    getInitialState: function() {
        return {
            value: SettingsStore.getValueAt(
                this.props.level,
                this.props.name,
                this.props.roomId,
                this.props.isExplicit,
            ),
        };
    },

    onChange: function(e) {
        if (this.props.group && !e.target.checked) return;

        const newState = this.props.group ? this.props.value : e.target.checked;
        if (!this.props.manualSave) this.save(newState);
        else this.setState({ value: newState });
        if (this.props.onChange) this.props.onChange(newState);
    },

    save: function(val = undefined) {
        return SettingsStore.setValue(
            this.props.name,
            this.props.roomId,
            this.props.level,
            val !== undefined ? val : this.state.value,
        );
    },

    render: function() {
        const value = this.props.manualSave ? this.state.value : SettingsStore.getValueAt(
            this.props.level,
            this.props.name,
            this.props.roomId,
            this.props.isExplicit,
        );

        const canChange = SettingsStore.canSetValue(this.props.name, this.props.roomId, this.props.level);

        let label = this.props.label;
        if (!label) label = SettingsStore.getDisplayName(this.props.name, this.props.level);
        else label = _t(label);

        // We generate a relatively complex ID to avoid conflicts
        const id = this.props.name + "_" + this.props.group + "_" + this.props.value + "_" + this.props.level;
        let checkbox = (
            <input id={id}
                   type="checkbox"
                   defaultChecked={value}
                   onChange={this.onChange}
                   disabled={!canChange}
            />
        );
        if (this.props.group) {
            checkbox = (
                <input id={id}
                       type="radio"
                       name={this.props.group}
                       value={this.props.value}
                       checked={value === this.props.value}
                       onChange={this.onChange}
                       disabled={!canChange}
                />
            );
        }

        return (
            <label>
                { checkbox }
                { label }
            </label>
        );
    },
});
