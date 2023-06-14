/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

// Inspiration largely taken from Mjolnir itself

import { ListRule, RECOMMENDATION_BAN, recommendationToStable } from "./ListRule";
import { MatrixClientPeg } from "../MatrixClientPeg";

export const RULE_USER = "m.policy.rule.user";
export const RULE_ROOM = "m.policy.rule.room";
export const RULE_SERVER = "m.policy.rule.server";

// m.room.* events are legacy from when MSC2313 changed to m.policy.* last minute.
export const USER_RULE_TYPES = [RULE_USER, "m.room.rule.user", "org.matrix.mjolnir.rule.user"];
export const ROOM_RULE_TYPES = [RULE_ROOM, "m.room.rule.room", "org.matrix.mjolnir.rule.room"];
export const SERVER_RULE_TYPES = [RULE_SERVER, "m.room.rule.server", "org.matrix.mjolnir.rule.server"];
export const ALL_RULE_TYPES = [...USER_RULE_TYPES, ...ROOM_RULE_TYPES, ...SERVER_RULE_TYPES];

export function ruleTypeToStable(rule: string): string | null {
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

    public get roomRules(): ListRule[] {
        return this._rules.filter((r) => r.kind === RULE_ROOM);
    }

    public async banEntity(kind: string, entity: string, reason: string): Promise<any> {
        const type = ruleTypeToStable(kind);
        if (!type) return; // unknown rule type
        await MatrixClientPeg.get().sendStateEvent(
            this._roomId,
            type,
            {
                entity: entity,
                reason: reason,
                recommendation: recommendationToStable(RECOMMENDATION_BAN, true),
            },
            "rule:" + entity,
        );
        this._rules.push(new ListRule(entity, RECOMMENDATION_BAN, reason, type));
    }

    public async unbanEntity(kind: string, entity: string): Promise<any> {
        const type = ruleTypeToStable(kind);
        if (!type) return; // unknown rule type
        // Empty state event is effectively deleting it.
        await MatrixClientPeg.get().sendStateEvent(this._roomId, type, {}, "rule:" + entity);
        this._rules = this._rules.filter((r) => {
            if (r.kind !== ruleTypeToStable(kind)) return true;
            if (r.entity !== entity) return true;
            return false; // we just deleted this rule
        });
    }

    public updateList(): void {
        this._rules = [];

        const room = MatrixClientPeg.get().getRoom(this._roomId);
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
