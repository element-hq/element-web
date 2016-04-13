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

'use strict';

var NotificationUtils = require('./NotificationUtils');

var encodeActions = NotificationUtils.encodeActions;
var decodeActions = NotificationUtils.decodeActions;

const ACTION_NOTIFY = encodeActions({notify: true});
const ACTION_NOTIFY_DEFAULT_SOUND = encodeActions({notify: true, sound: "default"});
const ACTION_NOTIFY_RING_SOUND = encodeActions({notify: true, sound: "ring"});
const ACTION_HIGHLIGHT_DEFAULT_SOUND = encodeActions({notify: true, sound: "default", highlight: true});
const ACTION_DONT_NOTIFY = encodeActions({notify: false});
const ACTION_DISABLED = null;

/**
 * The descriptions of rules managed by the Vector UI.
 */
module.exports = {
    // Messages containing user's display name
    // (skip contains_user_name which is too geeky)
    ".m.rule.contains_display_name": {
        kind: "underride",
        description: "Messages containing my name",
        vectorStateToActions: { // The actions for each vector state, or null to disable the rule.
            on: ACTION_NOTIFY,
            loud: ACTION_HIGHLIGHT_DEFAULT_SOUND,
            off: ACTION_DISABLED
        }
    },

    // Messages just sent to the user in a 1:1 room
    ".m.rule.room_one_to_one": {
        kind: "underride",
        description: "Messages in one-to-one chats",
        vectorStateToActions: {
            on: ACTION_NOTIFY,
            loud: ACTION_NOTIFY_DEFAULT_SOUND,
            off: ACTION_DONT_NOTIFY
        }
    },

    // Messages just sent to a group chat room
    // 1:1 room messages are catched by the .m.rule.room_one_to_one rule if any defined
    // By opposition, all other room messages are from group chat rooms.
    ".m.rule.message": {
        kind: "underride",
        description: "Messages in group chats",
        vectorStateToActions: {
            on: ACTION_NOTIFY,
            loud: ACTION_NOTIFY_DEFAULT_SOUND,
            off: ACTION_DONT_NOTIFY
        }
    },

    // Invitation for the user
    ".m.rule.invite_for_me": {
        kind: "underride",
        description: "When I'm invited to a room",
        vectorStateToActions: {
            on: ACTION_NOTIFY,
            loud: ACTION_NOTIFY_DEFAULT_SOUND,
            off: ACTION_DISABLED
        }
    },

    // Incoming call
    ".m.rule.call": {
        kind: "underride",
        description: "Call invitation",
        vectorStateToActions: {
            on: ACTION_NOTIFY,
            loud: ACTION_NOTIFY_RING_SOUND,
            off: ACTION_DISABLED
        }
    },

    // Notifications from bots
    ".m.rule.suppress_notices": {
        kind: "override",
        description: "Messages sent by bot",
        vectorStateToActions: {
            // .m.rule.suppress_notices is a "negative" rule, we have to invert its enabled value for vector UI
            on: ACTION_DISABLED,
            loud: ACTION_NOTIFY_DEFAULT_SOUND,
            off: ACTION_DONT_NOTIFY,
        }
    }
};
