/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent, EventType, IPushRules } from "matrix-js-sdk/src/matrix";

import { ActionPayload } from "../../../dispatcher/payloads";
import { isRuleMaybeRoomMuteRule } from "../../../RoomNotifs";
import { arrayDiff } from "../../../utils/arrays";

/**
 * Gets any changed push rules that are room specific overrides
 * that mute notifications
 * @param actionPayload
 * @returns {string[]} ruleIds of added or removed rules
 */
export const getChangedOverrideRoomMutePushRules = (actionPayload: ActionPayload): string[] | undefined => {
    if (
        actionPayload.action !== "MatrixActions.accountData" ||
        actionPayload.event?.getType() !== EventType.PushRules
    ) {
        return undefined;
    }
    const event = actionPayload.event as MatrixEvent;
    const prevEvent = actionPayload.previousEvent as MatrixEvent | undefined;

    if (!event || !prevEvent) {
        return undefined;
    }

    const roomPushRules = (event.getContent() as IPushRules)?.global?.override?.filter(isRuleMaybeRoomMuteRule);
    const prevRoomPushRules = (prevEvent?.getContent() as IPushRules)?.global?.override?.filter(
        isRuleMaybeRoomMuteRule,
    );

    const { added, removed } = arrayDiff(
        prevRoomPushRules?.map((rule) => rule.rule_id) || [],
        roomPushRules?.map((rule) => rule.rule_id) || [],
    );

    return [...added, ...removed];
};
