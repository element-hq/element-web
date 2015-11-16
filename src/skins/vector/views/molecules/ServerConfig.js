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
var Modal = require('matrix-react-sdk/lib/Modal');
var sdk = require('matrix-react-sdk')

var ServerConfigController = require('matrix-react-sdk/lib/controllers/molecules/ServerConfig')

module.exports = React.createClass({
    displayName: 'ServerConfig',
    mixins: [ServerConfigController],

    showHelpPopup: function() {
        var ErrorDialog = sdk.getComponent('organisms.ErrorDialog');
        Modal.createDialog(ErrorDialog, {
            title: 'Custom Server Options',
            description: <span>
                You can use the custom server options to log into other Matrix servers by specifying a different Home server URL.<br/>
                This allows you to use Vector with an existing Matrix account on a different Home server.<br/>
                <br/>
                You can also set a custom Identity server but this will affect people's ability to find you
                if you use a server in a group other than the main Matrix.org group.
            </span>,
            button: "Dismiss",
            focus: true,
        });
    },

    render: function() {
        return (
            <div className="mx_ServerConfig">
                <label className="mx_Login_label mx_ServerConfig_hslabel" htmlFor="hsurl">Home server URL</label>
                <input className="mx_Login_field" id="hsurl" type="text" placeholder={this.state.original_hs_url} value={this.state.hs_url} onChange={this.hsChanged} />
                <label className="mx_Login_label mx_ServerConfig_islabel" htmlFor="isurl">Identity server URL</label>
                <input className="mx_Login_field" id="isurl" type="text" placeholder={this.state.original_is_url} value={this.state.is_url} onChange={this.isChanged} />
                <a className="mx_ServerConfig_help" href="#" onClick={this.showHelpPopup}>What does this mean?</a>
            </div>
        );
    }
});
