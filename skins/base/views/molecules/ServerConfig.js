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

var ServerConfigController = require("../../../../src/controllers/molecules/ServerConfig");

module.exports = React.createClass({
    displayName: 'ServerConfig',
    mixins: [ServerConfigController],

    render: function() {
        return (
            <div className="mx_ServerConfig">
                <label className="mx_Login_label mx_ServerConfig_hslabel" htmlFor="hsurl">Home server URL</label>
                <input className="mx_Login_field" id="hsurl" type="text" value={this.state.hs_url} onChange={this.hsChanged} />
                <label className="mx_Login_label mx_ServerConfig_islabel" htmlFor="isurl">Identity server URL</label>
                <input className="mx_Login_field" type="text" value={this.state.is_url} onChange={this.isChanged} />
                <a className="mx_ServerConfig_help" href="#">What does this mean?</a>
            </div>
        );
    }
});
