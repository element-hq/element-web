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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import { _t } from '../../../languageHandler';

export default createReactClass({
    displayName: 'UserSelector',

    propTypes: {
        onChange: PropTypes.func,
        selected_users: PropTypes.arrayOf(PropTypes.string),
    },

    getDefaultProps: function() {
        return {
            onChange: function() {},
            selected: [],
        };
    },

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount: function() {
        this._user_id_input = createRef();
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
        this.addUser(this._user_id_input.current.value);
        this._user_id_input.current.value = "";
    },

    render: function() {
        const self = this;
        return (
            <div>
                <ul className="mx_UserSelector_UserIdList">
                    { this.props.selected_users.map(function(user_id, i) {
                        return <li key={user_id}>{ user_id } - <span onClick={function() {self.removeUser(user_id);}}>X</span></li>;
                    }) }
                </ul>
                <input type="text" ref={this._user_id_input} defaultValue="" className="mx_UserSelector_userIdInput" placeholder={_t("ex. @bob:example.com")} />
                <button onClick={this.onAddUserId} className="mx_UserSelector_AddUserId">
                    { _t("Add User") }
                </button>
            </div>
        );
    },
});
