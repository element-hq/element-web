/*
Copyright 2016 OpenMarket Ltd

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
var dis = require('matrix-react-sdk/lib/dispatcher')

module.exports = React.createClass({
    displayName: 'GuestWarningBar',

    onRegisterClicked: function() {
        dis.dispatch({'action': 'start_upgrade_registration'});
    },
 
    onLoginClicked: function() {
        dis.dispatch({'action': 'logout'});
        dis.dispatch({'action': 'start_login'});
    },

    render: function() {
        return (
            <div className="mx_GuestWarningBar">
                <img className="mx_GuestWarningBar_warning" src="img/warning.svg" width="24" height="23" alt="/!\"/>
                <div>
                    You are using Vector as a guest. <a onClick={this.onRegisterClicked}>Register</a> or <a onClick={this.onLoginClicked}>log in</a> to access more rooms and features.
                </div>
            </div>
        );
    }
});

