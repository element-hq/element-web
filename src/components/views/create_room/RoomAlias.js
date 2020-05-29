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

import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import { _t } from '../../../languageHandler';

export default createReactClass({
    displayName: 'RoomAlias',
    propTypes: {
        // Specifying a homeserver will make magical things happen when you,
        // e.g. start typing in the room alias box.
        homeserver: PropTypes.string,
        alias: PropTypes.string,
        onChange: PropTypes.func,
    },

    getDefaultProps: function() {
        return {
            onChange: function() {},
            alias: '',
        };
    },

    getAliasLocalpart: function() {
        let room_alias = this.props.alias;

        if (room_alias && this.props.homeserver) {
            const suffix = ":" + this.props.homeserver;
            if (room_alias.startsWith("#") && room_alias.endsWith(suffix)) {
                room_alias = room_alias.slice(1, -suffix.length);
            }
        }

        return room_alias;
    },

    onValueChanged: function(ev) {
        this.props.onChange(ev.target.value);
    },

    onFocus: function(ev) {
        const target = ev.target;
        const curr_val = ev.target.value;

        if (this.props.homeserver) {
            if (curr_val == "") {
                const self = this;
                setTimeout(function() {
                    target.value = "#:" + self.props.homeserver;
                    target.setSelectionRange(1, 1);
                }, 0);
            } else {
                const suffix = ":" + this.props.homeserver;
                setTimeout(function() {
                    target.setSelectionRange(
                        curr_val.startsWith("#") ? 1 : 0,
                        curr_val.endsWith(suffix) ? (target.value.length - suffix.length) : target.value.length,
                    );
                }, 0);
            }
        }
    },

    onBlur: function(ev) {
        const curr_val = ev.target.value;

        if (this.props.homeserver) {
            if (curr_val == "#:" + this.props.homeserver) {
                ev.target.value = "";
                return;
            }

            if (curr_val != "") {
                let new_val = ev.target.value;
                const suffix = ":" + this.props.homeserver;
                if (!curr_val.startsWith("#")) new_val = "#" + new_val;
                if (!curr_val.endsWith(suffix)) new_val = new_val + suffix;
                ev.target.value = new_val;
            }
        }
    },

    render: function() {
        return (
            <input type="text" className="mx_RoomAlias" placeholder={_t("Address (optional)")}
                onChange={this.onValueChanged} onFocus={this.onFocus} onBlur={this.onBlur}
                value={this.props.alias} />
        );
    },
});
