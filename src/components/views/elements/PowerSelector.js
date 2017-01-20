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

var React = require('react');

var roles = {
    0: 'User',
    50: 'Moderator',
    100: 'Admin',
};

var reverseRoles = {};
Object.keys(roles).forEach(function(key) {
    reverseRoles[roles[key]] = key;
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
            custom: (roles[this.props.value] === undefined),
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
            selectValue = roles[this.props.value] || "Custom";
        }
        var select;
        if (this.props.disabled) {
            select = <span>{ selectValue }</span>;
        }
        else {
            select =
                <select ref="select"
                        value={ this.props.controlled ? selectValue : undefined }
                        defaultValue={ !this.props.controlled ? selectValue : undefined }
                        onChange={ this.onSelectChange }>
                    <option value="User">User (0)</option>
                    <option value="Moderator">Moderator (50)</option>
                    <option value="Admin">Admin (100)</option>
                    <option value="Custom">Custom level</option>
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
