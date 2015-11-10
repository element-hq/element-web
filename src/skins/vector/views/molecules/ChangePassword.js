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

var ChangePasswordController = require('matrix-react-sdk/lib/controllers/molecules/ChangePassword')
var Loader = require("react-loader");


module.exports = React.createClass({
    displayName: 'ChangePassword',
    mixins: [ChangePasswordController],

    onClickChange: function() {
        var old_password = this.refs.old_input.value;
        var new_password = this.refs.new_input.value;
        var confirm_password = this.refs.confirm_input.value;
        if (new_password != confirm_password) {
            this.setState({
                state: this.Phases.Error,
                errorString: "Passwords don't match"
            });
        } else if (new_password == '' || old_password == '') {
            this.setState({
                state: this.Phases.Error,
                errorString: "Passwords can't be empty"
            });
        } else {
            this.changePassword(old_password, new_password);
        }
    },

    render: function() {
        switch (this.state.phase) {
            case this.Phases.Edit:
            case this.Phases.Error:
                return (
                    <div>
                        <div className="mx_Dialog_content">
                            <div>{this.state.errorString}</div>
                            <div><label>Old password <input type="password" ref="old_input"/></label></div>
                            <div><label>New password <input type="password" ref="new_input"/></label></div>
                            <div><label>Confirm password <input type="password" ref="confirm_input"/></label></div>
                        </div>
                        <div className="mx_Dialog_buttons">
                            <button onClick={this.onClickChange}>Change Password</button>
                            <button onClick={this.props.onFinished}>Cancel</button>
                        </div>
                    </div>
                );
            case this.Phases.Uploading:
                return (
                    <div className="mx_Dialog_content">
                        <Loader />
                    </div>
                );
            case this.Phases.Success:
                return (
                    <div>
                        <div className="mx_Dialog_content">
                            Success!
                        </div>
                        <div className="mx_Dialog_buttons">
                            <button onClick={this.props.onFinished}>Ok</button>
                        </div>
                    </div>
                )
        }
    }
});
