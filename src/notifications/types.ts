/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

export enum NotificationSetting {
    AllMessages = "all_messages", // .m.rule.message = notify
    DirectMessagesMentionsKeywords = "dm_mentions_keywords", // .m.rule.message = mark_unread. This is the new default.
    MentionsKeywordsOnly = "mentions_keywords", // .m.rule.message = mark_unread; .m.rule.room_one_to_one = mark_unread
    Never = "never", // .m.rule.master = enabled (dont_notify)
}

export interface ISoundTweak {
    // eslint-disable-next-line camelcase
    set_tweak: "sound";
    value: string;
}
export interface IHighlightTweak {
    // eslint-disable-next-line camelcase
    set_tweak: "highlight";
    value?: boolean;
}

export type Tweak = ISoundTweak | IHighlightTweak;

export enum Actions {
    Notify = "notify",
    DontNotify = "dont_notify", // no-op
    Coalesce = "coalesce", // unused
    MarkUnread = "mark_unread", // new
}

export type Action = Actions | Tweak;

// Push rule kinds in descending priority order
export enum Kind {
    Override = "override",
    ContentSpecific = "content",
    RoomSpecific = "room",
    SenderSpecific = "sender",
    Underride = "underride",
}

export interface IEventMatchCondition {
    kind: "event_match";
    key: string;
    pattern: string;
}

export interface IContainsDisplayNameCondition {
    kind: "contains_display_name";
}

export interface IRoomMemberCountCondition {
    kind: "room_member_count";
    is: string;
}

export interface ISenderNotificationPermissionCondition {
    kind: "sender_notification_permission";
    key: string;
}

export type Condition =
    IEventMatchCondition |
    IContainsDisplayNameCondition |
    IRoomMemberCountCondition |
    ISenderNotificationPermissionCondition;

export enum RuleIds {
    MasterRule = ".m.rule.master", // The master rule (all notifications disabling)
    MessageRule = ".m.rule.message",
    EncryptedMessageRule = ".m.rule.encrypted",
    RoomOneToOneRule = ".m.rule.room_one_to_one",
    EncryptedRoomOneToOneRule = ".m.rule.room_one_to_one",
}

export interface IPushRule {
    enabled: boolean;
    // eslint-disable-next-line camelcase
    rule_id: RuleIds | string;
    actions: Action[];
    default: boolean;
    conditions?: Condition[]; // only applicable to `underride` and `override` rules
    pattern?: string; // only applicable to `content` rules
}

// push rule extended with kind, used by ContentRules and js-sdk's pushprocessor
export interface IExtendedPushRule extends IPushRule {
    kind: Kind;
}

export interface IPushRuleSet {
    override: IPushRule[];
    content: IPushRule[];
    room: IPushRule[];
    sender: IPushRule[];
    underride: IPushRule[];
}

export interface IRuleSets {
    global: IPushRuleSet;
}
