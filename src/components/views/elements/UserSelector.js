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

module.exports = React.createClass({
    displayName: 'UserSelector',

    propTypes: {
        onChange: React.PropTypes.func,
        selected_users: React.PropTypes.arrayOf(React.PropTypes.string),
    },

    getDefaultProps: function() {
        return {
            onChange: function() {},
            selected: [],
        };
    },

    addUser: function(user_id) {
        if (this.props.selected_users.indexOf(user_id == -1)) {
            this.props.onChange(this.props.selected_users.concat([user_id]));
        }
    },

    removeUser: function(user_id) {
        this.props.onChange(this.props.selected_users.filter(function(e) {
            return e != user_id;
        }));
    },

    onAddUserId: function() {
        this.addUser(this.refs.user_id_input.value);
        this.refs.user_id_input.value = "";
    },

    render: function() {
        var self = this;
        return (
            <div>
                <ul className="mx_UserSelector_UserIdList" ref="list">
                    {this.props.selected_users.map(function(user_id, i) {
                        return <li key={user_id}>{user_id} - <span onClick={function() {self.removeUser(user_id);}}>X</span></li>
                    })}
                </ul>
                <input type="text" ref="user_id_input" defaultValue="" className="mx_UserSelector_userIdInput" placeholder="ex. @bob:example.com"/>
                <button onClick={this.onAddUserId} className="mx_UserSelector_AddUserId">
                    Add User
                </button>
            </div>
        );
    }
});
