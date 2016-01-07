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

var React = require('react');
var ReactDOM = require('react-dom');

/**
 * A pure UI component which displays a username/password form.
 */
module.exports = React.createClass({displayName: 'PasswordLogin',
    propTypes: {
        onSubmit: React.PropTypes.func.isRequired // fn(username, password)
    },

    getInitialState: function() {
        return {
            username: "",
            password: ""
        };
    },

    onSubmitForm: function(ev) {
        ev.preventDefault();
        this.props.onSubmit(this.state.username, this.state.password);
    },

    onUsernameChanged: function(ev) {
        this.setState({username: ev.target.value});
    },

    onPasswordChanged: function(ev) {
        this.setState({password: ev.target.value});
    },

    render: function() {
        return (
            <div>
                <form onSubmit={this.onSubmitForm}>
                <input className="mx_Login_field" ref="user" type="text"
                    value={this.state.username} onChange={this.onUsernameChanged}
                    placeholder="Email or user name" autoFocus />
                <br />
                <input className="mx_Login_field" ref="pass" type="password"
                    value={this.state.password} onChange={this.onPasswordChanged}
                    placeholder="Password" />
                <br />
                <input className="mx_Login_submit" type="submit" value="Log in" />
                </form>
            </div>
        );
    }
});