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
var sdk = require('../../../index');
var MatrixClientPeg = require("../../../MatrixClientPeg");

module.exports = React.createClass({
    displayName: 'ChangeDisplayName',

    _getDisplayName: function() {
        var cli = MatrixClientPeg.get();
        return cli.getProfileInfo(cli.credentials.userId).then(function(result) {
            var displayname = result.displayname;
            if (!displayname) {
                if (MatrixClientPeg.get().isGuest()) {
                    displayname = "Guest " + MatrixClientPeg.get().getUserIdLocalpart();
                }
                else {
                    displayname = MatrixClientPeg.get().getUserIdLocalpart();
                }
            }
            return displayname;
        }, function(error) {
            throw new Error("Failed to fetch display name");
        });
    },

    _changeDisplayName: function(new_displayname) {
        var cli = MatrixClientPeg.get();
        return cli.setDisplayName(new_displayname).catch(function(e) {
            throw new Error("Failed to set display name");
        });
    },

    render: function() {
        var EditableTextContainer = sdk.getComponent('elements.EditableTextContainer');
        return (
            <EditableTextContainer
                getInitialValue={this._getDisplayName}
                placeholder="No display name"
                blurToSubmit={true}
                onSubmit={this._changeDisplayName} />
        );
    }
});
