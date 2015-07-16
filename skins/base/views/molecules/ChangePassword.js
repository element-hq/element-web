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

var ChangePasswordController = require("../../../../src/controllers/molecules/ChangePassword");


module.exports = React.createClass({
    displayName: 'ChangePassword',
    mixins: [ChangePasswordController],

    render: function() {
        switch (this.state.phase) {
            case this.Phases.Edit:
            case this.Phases.Error:
                return (
                    <div>
                        <label>Old password <input type="password" /></label>
                        <label>New password <input type="password" /></label>
                        <label>Confirm password <input type="password" /></label>
                        <div>
                            <button>Change Password</button>
                            <button onClick={this.props.onFinished}>Cancel</button>
                        </div>
                    </div>
                );
            case this.Phases.Uploading:
                return (
                    <Loader />
                );
        }
    }
});
