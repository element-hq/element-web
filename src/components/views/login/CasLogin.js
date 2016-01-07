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

var MatrixClientPeg = require("../../../MatrixClientPeg");
var React = require('react');
var url = require("url");

module.exports = React.createClass({
    displayName: 'CasLogin',

    onCasClicked: function(ev) {
        var cli = MatrixClientPeg.get();
        var parsedUrl = url.parse(window.location.href, true);
        parsedUrl.query["homeserver"] = cli.getHomeserverUrl();
        parsedUrl.query["identityServer"] = cli.getIdentityServerUrl();
        var casUrl = MatrixClientPeg.get().getCasLoginUrl(url.format(parsedUrl));
        window.location.href = casUrl;
    },

    render: function() {
        return (
            <div>
                <button onClick={this.onCasClicked}>Sign in with CAS</button>
            </div>
        );
    }

});
