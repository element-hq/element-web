/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, EventType, type IPushRules } from "matrix-js-sdk/src/matrix";

import { type ActionPayload } from "../../../dispatcher/payloads";
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
