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
        initially_selected: React.PropTypes.arrayOf(React.PropTypes.string),
    },

    getDefaultProps: function() {
        return {
            initially_selected: [],
        };
    },

    getInitialState: function() {
        return {
            selected_users: this.props.initially_selected,
        }
    },

    addUser: function(user_id) {
        if (this.state.selected_users.indexOf(user_id == -1)) {
            this.setState({
                selected_users: this.state.selected_users.concat([user_id]),
            });
        }
    },

    removeUser: function(user_id) {
        this.setState({
            selected_users: this.state.selected_users.filter(function(e) {
                return e != user_id;
            }),
        });
    },

    getUserIds: function() {
        return this.state.selected_users;
    }
};
