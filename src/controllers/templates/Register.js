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

var extend = require('matrix-react-sdk/lib/extend');
var MatrixClientPeg = require('matrix-react-sdk/lib/MatrixClientPeg');
var BaseRegisterController = require('matrix-react-sdk/lib/controllers/templates/Register.js');

var RegisterController = {};
extend(RegisterController, BaseRegisterController);

RegisterController.onRegistered = function(user_id, access_token) {
    MatrixClientPeg.replaceUsingAccessToken(
        this.state.hs_url, this.state.is_url, user_id, access_token
    );

    this.setState({
        step: 'profile',
        busy: true
    });

    var self = this;
    var cli = MatrixClientPeg.get();
    cli.getProfileInfo(cli.credentials.userId).done(function(result) {
        self.setState({
            avatarUrl: result.avatar_url,
            busy: false
        });
    },
    function(err) {
        console.err(err);
        self.setState({
            busy: false
        });
    });
};

RegisterController.onAccountReady = function() {
    if (this.props.onLoggedIn) {
        this.props.onLoggedIn();
    }
};

module.exports = RegisterController;
