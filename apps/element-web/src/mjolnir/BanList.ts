/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Inspiration largely taken from Mjolnir itself

import { EventType } from "matrix-js-sdk/src/matrix";

import { ListRule, RECOMMENDATION_BAN, recommendationToStable } from "./ListRule";
import { MatrixClientPeg } from "../MatrixClientPeg";

export const RULE_USER = EventType.PolicyRuleUser;
export const RULE_ROOM = EventType.PolicyRuleRoom;
export const RULE_SERVER = EventType.PolicyRuleServer;

// m.room.* events are legacy from when MSC2313 changed to m.policy.* last minute.
export const USER_RULE_TYPES = [RULE_USER, "m.room.rule.user", "org.matrix.mjolnir.rule.user"];
export const ROOM_RULE_TYPES = [RULE_ROOM, "m.room.rule.room", "org.matrix.mjolnir.rule.room"];
export const SERVER_RULE_TYPES = [RULE_SERVER, "m.room.rule.server", "org.matrix.mjolnir.rule.server"];
export const ALL_RULE_TYPES = [...USER_RULE_TYPES, ...ROOM_RULE_TYPES, ...SERVER_RULE_TYPES];

export function ruleTypeToStable(
    rule: string,
): EventType.PolicyRuleUser | EventType.PolicyRuleRoom | EventType.PolicyRuleServer | null {
    if (USER_RULE_TYPES.includes(rule)) {
        return RULE_USER;
    }
    if (ROOM_RULE_TYPES.includes(rule)) {
        return RULE_ROOM;
    }
    if (SERVER_RULE_TYPES.includes(rule)) {
        return RULE_SERVER;
    }
    return null;
}

export class BanList {
    private _rules: ListRule[] = [];
    private _roomId: string;

    public constructor(roomId: string) {
        this._roomId = roomId;
        this.updateList();
    }

    public get roomId(): string {
        return this._roomId;
    }

    public get serverRules(): ListRule[] {
        return this._rules.filter((r) => r.kind === RULE_SERVER);
    }

    public get userRules(): ListRule[] {
        return this._rules.filter((r) => r.kind === RULE_USER);
    }

    public async banEntity(kind: string, entity: string, reason: string): Promise<any> {
        const type = ruleTypeToStable(kind);
        if (!type) return; // unknown rule type
        await MatrixClientPeg.safeGet().sendStateEvent(
            this._roomId,
            type,
            {
                entity: entity,
                reason: reason,
                recommendation: recommendationToStable(RECOMMENDATION_BAN, true)!,
            },
            "rule:" + entity,
        );
        this._rules.push(new ListRule(entity, RECOMMENDATION_BAN, reason, type));
    }

    public async unbanEntity(kind: string, entity: string): Promise<any> {
        const type = ruleTypeToStable(kind);
        if (!type) return; // unknown rule type
        // Empty state event is effectively deleting it.
        await MatrixClientPeg.safeGet().sendStateEvent(this._roomId, type, {}, "rule:" + entity);
        this._rules = this._rules.filter((r) => {
            if (r.kind !== ruleTypeToStable(kind)) return true;
            if (r.entity !== entity) return true;
            return false; // we just deleted this rule
        });
    }

    public updateList(): void {
        this._rules = [];

        const room = MatrixClientPeg.safeGet().getRoom(this._roomId);
        if (!room) return;

        for (const eventType of ALL_RULE_TYPES) {
            const events = room.currentState.getStateEvents(eventType);
            for (const ev of events) {
                if (!ev.getStateKey()) continue;

                const kind = ruleTypeToStable(eventType);
                if (!kind) continue; // unknown type

                const entity = ev.getContent()["entity"];
                const recommendation = ev.getContent()["recommendation"];
                const reason = ev.getContent()["reason"];
                if (!entity || !recommendation || !reason) continue;

                this._rules.push(new ListRule(entity, recommendation, reason, kind));
            }
        }
    }
}
