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

'use strict';

import React from 'react';
import * as Roles from '../../../Roles';

var reverseRoles = {};
Object.keys(Roles.LEVEL_ROLE_MAP).forEach(function(key) {
    reverseRoles[Roles.LEVEL_ROLE_MAP[key]] = key;
});

module.exports = React.createClass({
    displayName: 'PowerSelector',

    propTypes: {
        value: React.PropTypes.number.isRequired,

        // if true, the <select/> should be a 'controlled' form element and updated by React
        // to reflect the current value, rather than left freeform.
        // MemberInfo uses controlled; RoomSettings uses non-controlled.
        //
        // ignored if disabled is truthy. false by default.
        controlled: React.PropTypes.bool,

        // should the user be able to change the value? false by default.
        disabled: React.PropTypes.bool,
        onChange: React.PropTypes.func,
    },

    getInitialState: function() {
        return {
            custom: (Roles.LEVEL_ROLE_MAP[this.props.value] === undefined),
        };
    },

    onSelectChange: function(event) {
        this.setState({ custom: event.target.value === "Custom" });
        if (event.target.value !== "Custom") {
            this.props.onChange(this.getValue());
        }
    },

    onCustomBlur: function(event) {
        this.props.onChange(this.getValue());
    },

    onCustomKeyDown: function(event) {
        if (event.key == "Enter") {
            this.props.onChange(this.getValue());
        }
    },

    getValue: function() {
        var value;
        if (this.refs.select) {
            value = reverseRoles[this.refs.select.value];
            if (this.refs.custom) {
                if (value === undefined) value = parseInt( this.refs.custom.value );
            }
        }
        return value;
    },

    render: function() {
        var customPicker;
        if (this.state.custom) {
            var input;
            if (this.props.disabled) {
                input = <span>{ this.props.value }</span>;
            }
            else {
                input = <input ref="custom" type="text" size="3" defaultValue={ this.props.value } onBlur={ this.onCustomBlur } onKeyDown={ this.onCustomKeyDown }/>;
            }
            customPicker = <span> of { input }</span>;
        }

        var selectValue;
        if (this.state.custom) {
            selectValue = "Custom";
        }
        else {
            selectValue = Roles.LEVEL_ROLE_MAP[this.props.value] || "Custom";
        }
        var select;
        if (this.props.disabled) {
            select = <span>{ selectValue }</span>;
        }
        else {
            // Each level must have a definition in LEVEL_ROLE_MAP
            const levels = [0, 50, 100];
            let options = levels.map((level) => {
                return {
                    value: Roles.LEVEL_ROLE_MAP[level],
                    // Give a userDefault (users_default in the power event) of 0 but
                    // because level !== undefined, this should never be used.
                    text: Roles.textualPowerLevel(level, 0),
                }
            });
            options.push({ value: "Custom", text: "Custom level" });
            options = options.map((op) => {
                return <option value={op.value}>{op.text}</option>;
            });

            select =
                <select ref="select"
                        value={ this.props.controlled ? selectValue : undefined }
                        defaultValue={ !this.props.controlled ? selectValue : undefined }
                        onChange={ this.onSelectChange }>
                    { options }
                </select>;
        }

        return (
            <span className="mx_PowerSelector">
                { select }
                { customPicker }
            </span>
        );
    }
});
