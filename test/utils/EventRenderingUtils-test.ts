/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
