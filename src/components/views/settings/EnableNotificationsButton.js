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
var React = require("react");
var Notifier = require("../../../Notifier");
var dis = require("../../../dispatcher");

module.exports = React.createClass({
    displayName: 'EnableNotificationsButton',

    componentDidMount: function() {
        this.dispatcherRef = dis.register(this.onAction);
    },

    componentWillUnmount: function() {
        dis.unregister(this.dispatcherRef);
    },

    onAction: function(payload) {
        if (payload.action !== "notifier_enabled") {
            return;
        }
        this.forceUpdate();
    },

    enabled: function() {
        return Notifier.isEnabled();
    },

    onClick: function() {
        var self = this;
        if (!Notifier.supportsDesktopNotifications()) {
            return;
        }
        if (!Notifier.isEnabled()) {
            Notifier.setEnabled(true, function() {
                self.forceUpdate();
            });
        } else {
            Notifier.setEnabled(false);
        }
        this.forceUpdate();
    },

    render: function() {
        if (this.enabled()) {
            return (
                <button className="mx_EnableNotificationsButton" onClick={this.onClick}>
                    Disable Notifications
                </button>
            );
        } else {
            return (
                <button className="mx_EnableNotificationsButton" onClick={this.onClick}>
                    Enable Notifications
                </button>
            );
        }
    }
});
