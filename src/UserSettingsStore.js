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

var MatrixClientPeg = require("./MatrixClientPeg");
var sdk = require('./index');

// XXX: should we be doing something here to use this as a singleton rather than
// class methods?

module.exports = {

    // we add these wrappers to the js-sdk here in case we want to do react-specific
    // dispatches or similar in future, and to give us a place to clearly separate
    // business logic specific from the 'thin' react component and parent wiring component
    //  which actually handles the UI.
    // XXX: I'm not convinced this abstraction is worth it though.

    loadProfileInfo: function() {
        var cli = MatrixClientPeg.get();
        return cli.getProfileInfo(cli.credentials.userId);
    },

    saveDisplayName: function(newDisplayname) {
        return MatrixClientPeg.get().setDisplayName(newDisplayname);
    },

    loadThreePids: function() {
        return MatrixClientPeg.get().getThreePids();
    },

    saveThreePids: function(threePids) {

    },

    getEnableNotifications: function() {
        var Notifier = sdk.getComponent('organisms.Notifier');
        return Notifier.isEnabled();
    },

    setEnableNotifications: function(enable) {
        var Notifier = sdk.getComponent('organisms.Notifier');
        var self = this;
        if (!Notifier.supportsDesktopNotifications()) {
            return;
        }
        Notifier.setEnabled(enable);
    },

    changePassword: function(old_password, new_password) {
        var cli = MatrixClientPeg.get();

        var authDict = {
            type: 'm.login.password',
            user: cli.credentials.userId,
            password: old_password
        };

        this.setState({
            phase: this.Phases.Uploading,
            errorString: '',
        })

        return cli.setPassword(authDict, new_password);
    },
}
