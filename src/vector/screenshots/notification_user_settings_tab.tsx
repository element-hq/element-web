import { IPushRules } from "matrix-js-sdk/src/@types/PushRules";
import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";
import { PushProcessor } from 'matrix-js-sdk/src/pushprocessor';
import React, { ReactElement } from 'react';
import * as sdk from 'matrix-react-sdk';

export function screenshotNotificationUserSettingsTab(): ReactElement {
    MatrixClientPeg.get().getPushRules = async () => {
        return PushProcessor.rewriteDefaultRules(pushRulesJson() as IPushRules);
    };

    MatrixClientPeg.get().getPushers = async () => {
        return { pushers: [] };
    };
    MatrixClientPeg.get().getThreePids = async () => {
        return { threepids: [] };
    };

    const NotificationUserSettingsTab= sdk.getComponent(
        'views.settings.tabs.user.NotificationUserSettingsTab');
    return <NotificationUserSettingsTab />;
}

function pushRulesJson() {
    // This is a lightly-modified paste of the JSON returned from a GET
    // to /pushrules/

    /* eslint-disable */
    return {
        "global": {
            "underride": [
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.call.invite" },
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "ring" },
                        { "set_tweak": "highlight", "value": false },
                    ],
                    "rule_id": ".m.rule.call",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "room_member_count", "is": "2" },
                        { "kind": "event_match", "key": "type", "pattern": "m.room.message" },
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight", "value": false },
                    ],
                    "rule_id": ".m.rule.room_one_to_one",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "room_member_count", "is": "2" },
                        { "kind": "event_match", "key": "type", "pattern": "m.room.encrypted" },
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight", "value": false },
                    ],
                    "rule_id": ".m.rule.encrypted_room_one_to_one",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.message" },
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.message",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.encrypted" },
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.encrypted",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "im.vector.modular.widgets" },
                        { "kind": "event_match", "key": "content.type", "pattern": "jitsi" },
                        { "kind": "event_match", "key": "state_key", "pattern": "*" },
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "highlight", "value": false },
                    ],
                    "rule_id": ".im.vector.jitsi",
                    "default": true,
                    "enabled": true,
                },
            ],
            "sender": [],
            "room": [],
            "content": [
                {
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight" },
                    ],
                    "pattern": "username",
                    "rule_id": ".m.rule.contains_user_name",
                    "default": true,
                    "enabled": true,
                },
            ],
            "override": [
                {
                    "conditions": [],
                    "actions": [
                        "dont_notify"
                    ],
                    "rule_id": ".m.rule.master",
                    "default": true,
                    "enabled": false,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "content.msgtype", "pattern": "m.notice" }
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.suppress_notices",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.member" },
                        { "kind": "event_match", "key": "content.membership", "pattern": "invite" },
                        { "kind": "event_match", "key": "state_key", "pattern": "@username:example.com" }
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight", "value": false }
                    ],
                    "rule_id": ".m.rule.invite_for_me",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.member" }
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.member_event",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "contains_display_name" }
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "sound", "value": "default" },
                        { "set_tweak": "highlight" }
                    ],
                    "rule_id": ".m.rule.contains_display_name",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "content.body", "pattern": "@room" },
                        { "kind": "sender_notification_permission", "key": "room" }
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "highlight", "value": true }
                    ],
                    "rule_id": ".m.rule.roomnotif",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.room.tombstone" },
                        { "kind": "event_match", "key": "state_key", "pattern": "" }
                    ],
                    "actions": [
                        "notify",
                        { "set_tweak": "highlight", "value": true }
                    ],
                    "rule_id": ".m.rule.tombstone",
                    "default": true,
                    "enabled": true,
                },
                {
                    "conditions": [
                        { "kind": "event_match", "key": "type", "pattern": "m.reaction" }
                    ],
                    "actions": [
                        "dont_notify",
                    ],
                    "rule_id": ".m.rule.reaction",
                    "default": true,
                    "enabled": true,
                }
            ],
        },
        "device": {},
    };
    /* eslint-enable */
}

