/*
Copyright 2015, 2016 OpenMarket Ltd
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
import { _t } from '../../../languageHandler';

const Presets = {
    PrivateChat: "private_chat",
    PublicChat: "public_chat",
    Custom: "custom",
};

export default createReactClass({
    displayName: 'CreateRoomPresets',
    propTypes: {
        onChange: PropTypes.func,
        preset: PropTypes.string,
    },

    Presets: Presets,

    getDefaultProps: function() {
        return {
            onChange: function() {},
        };
    },

    onValueChanged: function(ev) {
        this.props.onChange(ev.target.value);
    },

    render: function() {
        return (
            <select className="mx_Presets" onChange={this.onValueChanged} value={this.props.preset}>
                <option value={this.Presets.PrivateChat}>{ _t("Private Chat") }</option>
                <option value={this.Presets.PublicChat}>{ _t("Public Chat") }</option>
                <option value={this.Presets.Custom}>{ _t("Custom") }</option>
            </select>
        );
    },
});
