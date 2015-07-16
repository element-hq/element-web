/*
Copyright 2015 OpenMarket Ltd

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

module.exports = {
    propTypes: {
        homeserver: React.PropTypes.string,
        default_alias: React.PropTypes.string
    },

    getDefaultProps: function() {
        return {
            default_alias: '',
        };
    },

    getInitialState: function() {
        return {
            room_alias: this.props.default_alias,
        }
    },

    getAliasLocalpart: function() {
        var room_alias = this.state.room_alias;

        if (room_alias && this.props.homeserver) {
            var suffix = ":" + this.props.homeserver;
            if (room_alias.startsWith("#") && room_alias.endsWith(suffix)) {
                room_alias = room_alias.slice(1, -suffix.length);
            }
        }

        return room_alias;
    },
};
