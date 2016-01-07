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
var MatrixClientPeg = require("../../../MatrixClientPeg");
var sdk = require("../../../index");

module.exports = React.createClass({
    displayName: 'ChangePassword',
    propTypes: {
        onFinished: React.PropTypes.func,
        onError: React.PropTypes.func,
        onCheckPassword: React.PropTypes.func,
        rowClassName: React.PropTypes.string,
        rowLabelClassName: React.PropTypes.string,
        rowInputClassName: React.PropTypes.string,
        buttonClassName: React.PropTypes.string
    },

    Phases: {
        Edit: "edit",
        Uploading: "uploading",
        Error: "error"
    },

    getDefaultProps: function() {
        return {
            onFinished: function() {},
            onError: function() {},
            onCheckPassword: function(oldPass, newPass, confirmPass) {
                if (newPass !== confirmPass) {
                    return {
                        error: "New passwords don't match."
                    };
                } else if (!newPass || newPass.length === 0) {
                    return {
                        error: "Passwords can't be empty"
                    };
                }
            }
        };
    },

    getInitialState: function() {
        return {
            phase: this.Phases.Edit
        }
    },

    changePassword: function(old_password, new_password) {
        var cli = MatrixClientPeg.get();

        var authDict = {
            type: 'm.login.password',
            user: cli.credentials.userId,
            password: old_password
        };

        this.setState({
            phase: this.Phases.Uploading
        });

        var self = this;
        cli.setPassword(authDict, new_password).then(function() {
            self.props.onFinished();
        }, function(err) {
            self.props.onError(err);
        }).finally(function() {
            self.setState({
                phase: self.Phases.Edit
            });
        }).done();
    },

    onClickChange: function() {
        var old_password = this.refs.old_input.value;
        var new_password = this.refs.new_input.value;
        var confirm_password = this.refs.confirm_input.value;
        var err = this.props.onCheckPassword(
            old_password, new_password, confirm_password
        );
        if (err) {
            this.props.onError(err);
        }
        else {
            this.changePassword(old_password, new_password);
        }
    },

    render: function() {
        var rowClassName = this.props.rowClassName;
        var rowLabelClassName = this.props.rowLabelClassName;
        var rowInputClassName = this.props.rowInputClassName
        var buttonClassName = this.props.buttonClassName;

        switch (this.state.phase) {
            case this.Phases.Edit:
                return (
                    <div className={this.props.className}>
                        <div className={rowClassName}>
                            <div className={rowLabelClassName}>
                                <label htmlFor="passwordold">Current password</label>
                            </div>
                            <div className={rowInputClassName}>
                                <input id="passwordold" type="password" ref="old_input" />
                            </div>
                        </div>
                        <div className={rowClassName}>
                            <div className={rowLabelClassName}>
                                <label htmlFor="password1">New password</label>
                            </div>
                            <div className={rowInputClassName}>
                                <input id="password1" type="password" ref="new_input" />
                            </div>
                        </div>
                        <div className={rowClassName}>
                            <div className={rowLabelClassName}>
                                <label htmlFor="password2">Confirm password</label>
                            </div>
                            <div className={rowInputClassName}>
                                <input id="password2" type="password" ref="confirm_input" />
                            </div>
                        </div>
                        <div className={buttonClassName} onClick={this.onClickChange}>
                            Change Password
                        </div>
                    </div>
                );
            case this.Phases.Uploading:
                var Loader = sdk.getComponent("elements.Spinner");
                return (
                    <div className="mx_Dialog_content">
                        <Loader />
                    </div>
                );
        }
    }
});
