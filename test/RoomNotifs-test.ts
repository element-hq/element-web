/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { mocked } from 'jest-mock';
import { ConditionKind, PushRuleActionName, TweakName } from "matrix-js-sdk/src/@types/PushRules";

import { stubClient } from "./test-utils";
import { MatrixClientPeg } from "../src/MatrixClientPeg";
import { getRoomNotifsState, RoomNotifState } from "../src/RoomNotifs";

describe("RoomNotifs test", () => {
    beforeEach(() => {
        stubClient();
    });

    it("getRoomNotifsState handles rules with no conditions", () => {
        mocked(MatrixClientPeg.get()).pushRules = {
            global: {
                override: [{
                    rule_id: "!roomId:server",
                    enabled: true,
                    default: false,
                    actions: [],
                }],
            },
        };
        expect(getRoomNotifsState("!roomId:server")).toBe(null);
    });

    it("getRoomNotifsState handles guest users", () => {
        mocked(MatrixClientPeg.get()).isGuest.mockReturnValue(true);
        expect(getRoomNotifsState("!roomId:server")).toBe(RoomNotifState.AllMessages);
    });

    it("getRoomNotifsState handles mute state", () => {
        MatrixClientPeg.get().pushRules = {
            global: {
                override: [{
                    rule_id: "!roomId:server",
                    enabled: true,
                    default: false,
                    conditions: [{
                        kind: ConditionKind.EventMatch,
                        key: "room_id",
                        pattern: "!roomId:server",
                    }],
                    actions: [PushRuleActionName.DontNotify],
                }],
            },
        };
        expect(getRoomNotifsState("!roomId:server")).toBe(RoomNotifState.Mute);
    });

    it("getRoomNotifsState handles mentions only", () => {
        MatrixClientPeg.get().getRoomPushRule = () => ({
            rule_id: "!roomId:server",
            enabled: true,
            default: false,
            actions: [PushRuleActionName.DontNotify],
        });
        expect(getRoomNotifsState("!roomId:server")).toBe(RoomNotifState.MentionsOnly);
    });

    it("getRoomNotifsState handles noisy", () => {
        MatrixClientPeg.get().getRoomPushRule = () => ({
            rule_id: "!roomId:server",
            enabled: true,
            default: false,
            actions: [{ set_tweak: TweakName.Sound, value: "default" }],
        });
        expect(getRoomNotifsState("!roomId:server")).toBe(RoomNotifState.AllMessagesLoud);
    });
});
