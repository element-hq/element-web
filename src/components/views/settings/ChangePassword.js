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
var Modal = require("../../../Modal");
var sdk = require("../../../index");
import AccessibleButton from '../elements/AccessibleButton';

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
        };
    },

    changePassword: function(oldPassword, newPassword) {
        const cli = MatrixClientPeg.get();

        if (this.props.disableConfirmation) {
            this._changePassword(cli, oldPassword, newPassword);
            return;
        }

        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        Modal.createDialog(QuestionDialog, {
            title: "Warning",
            description:
                <div>
                    Changing password will currently reset any end-to-end encryption keys on all devices,
                    making encrypted chat history unreadable, unless you first export your room keys
                    and re-import them afterwards.
                    In future this <a href="https://github.com/vector-im/riot-web/issues/2671">will be improved</a>.
                </div>,
            button: "Continue",
            extraButtons: [
                <button className="mx_Dialog_primary"
                        onClick={this._onExportE2eKeysClicked}>
                    Export E2E room keys
                </button>
            ],
            onFinished: (confirmed) => {
                if (confirmed) {
                    this._changePassword(cli, oldPassword, newPassword);
                }
            },
        });
    },

    _changePassword: function(cli, oldPassword, newPassword) {
        const authDict = {
            type: 'm.login.password',
            user: cli.credentials.userId,
            password: oldPassword,
        };

        this.setState({
            phase: this.Phases.Uploading,
        });

        cli.setPassword(authDict, newPassword).then(() => {
            this.props.onFinished();
        }, (err) => {
            this.props.onError(err);
        }).finally(() => {
            this.setState({
                phase: this.Phases.Edit,
            });
        }).done();
    },

    _onExportE2eKeysClicked: function() {
        Modal.createDialogAsync(
            (cb) => {
                require.ensure(['../../../async-components/views/dialogs/ExportE2eKeysDialog'], () => {
                    cb(require('../../../async-components/views/dialogs/ExportE2eKeysDialog'));
                }, "e2e-export");
            }, {
                matrixClient: MatrixClientPeg.get(),
            }
        );
    },

    onClickChange: function() {
        const oldPassword = this.refs.old_input.value;
        const newPassword = this.refs.new_input.value;
        const confirmPassword = this.refs.confirm_input.value;
        const err = this.props.onCheckPassword(
            oldPassword, newPassword, confirmPassword,
        );
        if (err) {
            this.props.onError(err);
        } else {
            this.changePassword(oldPassword, newPassword);
        }
    },

    render: function() {
        var rowClassName = this.props.rowClassName;
        var rowLabelClassName = this.props.rowLabelClassName;
        var rowInputClassName = this.props.rowInputClassName;
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
                        <AccessibleButton className={buttonClassName}
                                onClick={this.onClickChange}
                                element="button">
                            Change Password
                        </AccessibleButton>
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
