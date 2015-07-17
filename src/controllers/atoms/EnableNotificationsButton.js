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

module.exports = {
    notificationsAvailable: function() {
        return !!global.Notification;
    },

    havePermission: function() {
        return global.Notification.permission == 'granted';
    },

    enabled: function() {
        if (!this.havePermission()) return false;

        if (!global.localStorage) return true;

        var enabled = global.localStorage.getItem('notifications_enabled');
        if (enabled === null) return true;
        return enabled === 'true';
    },

    disable: function() {
        if (!global.localStorage) return;
        global.localStorage.setItem('notifications_enabled', 'false');
        this.forceUpdate();
    },

    enable: function() {
        if (!this.havePermission()) {
            var self = this;
            global.Notification.requestPermission(function() {
                self.forceUpdate();
            });
        }

        if (!global.localStorage) return;
        global.localStorage.setItem('notifications_enabled', 'true');
        this.forceUpdate();
    },

    onClick: function() {
        if (!this.notificationsAvailable()) {
            return;
        }
        if (!this.enabled()) {
            this.enable();
        } else {
            this.disable();
        }
    },
};
