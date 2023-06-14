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

import { getEventDisplayInfo } from "../../src/utils/EventRenderingUtils";
import { VoiceBroadcastInfoState } from "../../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "../voice-broadcast/utils/test-utils";
import { createTestClient } from "../test-utils";

describe("getEventDisplayInfo", () => {
    const mkBroadcastInfoEvent = (state: VoiceBroadcastInfoState) => {
        return mkVoiceBroadcastInfoStateEvent("!room:example.com", state, "@user:example.com", "ASD123");
    };

    it("should return the expected value for a broadcast started event", () => {
        expect(getEventDisplayInfo(createTestClient(), mkBroadcastInfoEvent(VoiceBroadcastInfoState.Started), false))
            .toMatchInlineSnapshot(`
            {
              "hasRenderer": true,
              "isBubbleMessage": false,
              "isInfoMessage": false,
              "isLeftAlignedBubbleMessage": false,
              "isSeeingThroughMessageHiddenForModeration": false,
              "noBubbleEvent": true,
            }
        `);
    });

    it("should return the expected value for a broadcast stopped event", () => {
        expect(getEventDisplayInfo(createTestClient(), mkBroadcastInfoEvent(VoiceBroadcastInfoState.Stopped), false))
            .toMatchInlineSnapshot(`
            {
              "hasRenderer": true,
              "isBubbleMessage": false,
              "isInfoMessage": true,
              "isLeftAlignedBubbleMessage": false,
              "isSeeingThroughMessageHiddenForModeration": false,
              "noBubbleEvent": true,
            }
        `);
    });
});
