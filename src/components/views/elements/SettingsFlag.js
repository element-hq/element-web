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
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import SettingsStore from "../../../settings/SettingsStore";
import { _t } from '../../../languageHandler';
import ToggleSwitch from "./ToggleSwitch";

export default createReactClass({
    displayName: 'SettingsFlag',
    propTypes: {
        name: PropTypes.string.isRequired,
        level: PropTypes.string.isRequired,
        roomId: PropTypes.string, // for per-room settings
        label: PropTypes.string, // untranslated
        onChange: PropTypes.func,
        isExplicit: PropTypes.bool,
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

    onChange: function(checked) {
        if (this.props.group && !checked) return;

        this.save(checked);
        this.setState({ value: checked });
        if (this.props.onChange) this.props.onChange(checked);
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
        const canChange = SettingsStore.canSetValue(this.props.name, this.props.roomId, this.props.level);

        let label = this.props.label;
        if (!label) label = SettingsStore.getDisplayName(this.props.name, this.props.level);
        else label = _t(label);

        return (
            <div className="mx_SettingsFlag">
                <span className="mx_SettingsFlag_label">{label}</span>
                <ToggleSwitch checked={this.state.value} onChange={this.onChange} disabled={!canChange} aria-label={label} />
            </div>
        );
    },
});
