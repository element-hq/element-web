/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

// allow camelcase as these are things that go onto the wire
/* eslint-disable camelcase */

export enum PushRuleActionName {
    DontNotify = "dont_notify",
    Notify = "notify",
    Coalesce = "coalesce",
}

export enum TweakName {
    Highlight = "highlight",
    Sound = "sound",
}

export type Tweak<N extends TweakName, V> = {
    set_tweak: N;
    value?: V;
};

export type TweakHighlight = Tweak<TweakName.Highlight, boolean>;
export type TweakSound = Tweak<TweakName.Sound, string>;

export type Tweaks = TweakHighlight | TweakSound;

export enum ConditionOperator {
    ExactEquals = "==",
    LessThan = "<",
    GreaterThan = ">",
    GreaterThanOrEqual = ">=",
    LessThanOrEqual = "<=",
}

export type PushRuleAction = Tweaks | PushRuleActionName;

export type MemberCountCondition<N extends number, Op extends ConditionOperator = ConditionOperator.ExactEquals> =
    | `${Op}${N}`
    | (Op extends ConditionOperator.ExactEquals ? `${N}` : never);

export type AnyMemberCountCondition = MemberCountCondition<number, ConditionOperator>;

export const DMMemberCountCondition: MemberCountCondition<2> = "2";

export function isDmMemberCountCondition(condition: AnyMemberCountCondition): boolean {
    return condition === "==2" || condition === "2";
}

export enum ConditionKind {
    EventMatch = "event_match",
    EventPropertyIs = "event_property_is",
    EventPropertyContains = "event_property_contains",
    ContainsDisplayName = "contains_display_name",
    RoomMemberCount = "room_member_count",
    SenderNotificationPermission = "sender_notification_permission",
    CallStarted = "call_started",
    CallStartedPrefix = "org.matrix.msc3914.call_started",
}

export interface IPushRuleCondition<N extends ConditionKind | string> {
    [k: string]: any; // for custom conditions, there can be other fields here
    kind: N;
}

export interface IEventMatchCondition extends IPushRuleCondition<ConditionKind.EventMatch> {
    key: string;
    pattern?: string;
    // Note that value property is an optimization for patterns which do not do
    // any globbing and when the key is not "content.body".
    value?: string;
}

export interface IEventPropertyIsCondition extends IPushRuleCondition<ConditionKind.EventPropertyIs> {
    key: string;
    value: string | boolean | null | number;
}

export interface IEventPropertyContainsCondition extends IPushRuleCondition<ConditionKind.EventPropertyContains> {
    key: string;
    value: string | boolean | null | number;
}

export interface IContainsDisplayNameCondition extends IPushRuleCondition<ConditionKind.ContainsDisplayName> {
    // no additional fields
}

export interface IRoomMemberCountCondition extends IPushRuleCondition<ConditionKind.RoomMemberCount> {
    is: AnyMemberCountCondition;
}

export interface ISenderNotificationPermissionCondition
    extends IPushRuleCondition<ConditionKind.SenderNotificationPermission> {
    key: string;
}

export interface ICallStartedCondition extends IPushRuleCondition<ConditionKind.CallStarted> {
    // no additional fields
}

export interface ICallStartedPrefixCondition extends IPushRuleCondition<ConditionKind.CallStartedPrefix> {
    // no additional fields
}

// XXX: custom conditions are possible but always fail, and break the typescript discriminated union so ignore them here
// IPushRuleCondition<Exclude<string, ConditionKind>> unfortunately does not resolve this at the time of writing.
export type PushRuleCondition =
    | IEventMatchCondition
    | IEventPropertyIsCondition
    | IEventPropertyContainsCondition
    | IContainsDisplayNameCondition
    | IRoomMemberCountCondition
    | ISenderNotificationPermissionCondition
    | ICallStartedCondition
    | ICallStartedPrefixCondition;

export enum PushRuleKind {
    Override = "override",
    ContentSpecific = "content",
    RoomSpecific = "room",
    SenderSpecific = "sender",
    Underride = "underride",
}

export enum RuleId {
    Master = ".m.rule.master",
    IsUserMention = ".org.matrix.msc3952.is_user_mention",
    IsRoomMention = ".org.matrix.msc3952.is_room_mention",
    ContainsDisplayName = ".m.rule.contains_display_name",
    ContainsUserName = ".m.rule.contains_user_name",
    AtRoomNotification = ".m.rule.roomnotif",
    DM = ".m.rule.room_one_to_one",
    EncryptedDM = ".m.rule.encrypted_room_one_to_one",
    Message = ".m.rule.message",
    EncryptedMessage = ".m.rule.encrypted",
    InviteToSelf = ".m.rule.invite_for_me",
    MemberEvent = ".m.rule.member_event",
    IncomingCall = ".m.rule.call",
    SuppressNotices = ".m.rule.suppress_notices",
    Tombstone = ".m.rule.tombstone",
    PollStart = ".m.rule.poll_start",
    PollStartUnstable = ".org.matrix.msc3930.rule.poll_start",
    PollEnd = ".m.rule.poll_end",
    PollEndUnstable = ".org.matrix.msc3930.rule.poll_end",
    PollStartOneToOne = ".m.rule.poll_start_one_to_one",
    PollStartOneToOneUnstable = ".org.matrix.msc3930.rule.poll_start_one_to_one",
    PollEndOneToOne = ".m.rule.poll_end_one_to_one",
    PollEndOneToOneUnstable = ".org.matrix.msc3930.rule.poll_end_one_to_one",
}

export type PushRuleSet = {
    [k in PushRuleKind]?: IPushRule[];
};

export interface IPushRule {
    actions: PushRuleAction[];
    conditions?: PushRuleCondition[];
    default: boolean;
    enabled: boolean;
    pattern?: string;
    rule_id: RuleId | string;
}

export interface IAnnotatedPushRule extends IPushRule {
    kind: PushRuleKind;
}

export interface IPushRules {
    global: PushRuleSet;
    device?: PushRuleSet;
}

export interface IPusher {
    "app_display_name": string;
    "app_id": string;
    "data": {
        format?: string;
        url?: string; // TODO: Required if kind==http
        brand?: string; // TODO: For email notifications only? Unspecced field
    };
    "device_display_name": string;
    "kind": "http" | string;
    "lang": string;
    "profile_tag"?: string;
    "pushkey": string;
    "enabled"?: boolean | null;
    "org.matrix.msc3881.enabled"?: boolean | null;
    "device_id"?: string | null;
    "org.matrix.msc3881.device_id"?: string | null;
}

export interface IPusherRequest extends Omit<IPusher, "device_id" | "org.matrix.msc3881.device_id"> {
    append?: boolean;
}

/* eslint-enable camelcase */
