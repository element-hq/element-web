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
import { Mid, Ssrc, MediaSsrcHandler } from "../../../../../src/webrtc/stats/media/mediaSsrcHandler";
import { REMOTE_SFU_DESCRIPTION } from "../../../../test-utils/webrtc";

describe("MediaSsrcHandler", () => {
    const remoteMap = new Map<Mid, Ssrc[]>([
        ["0", ["2963372119"]],
        ["1", ["1212931603"]],
    ]);
    let handler: MediaSsrcHandler;
    beforeEach(() => {
        handler = new MediaSsrcHandler();
    });
    describe("should parse description", () => {
        it("and build mid ssrc map", async () => {
            handler.parse(REMOTE_SFU_DESCRIPTION, "remote");
            expect(handler.getSsrcToMidMap("remote")).toEqual(remoteMap);
        });
    });

    describe("should on find mid by ssrc", () => {
        it("and return mid if mapping exists.", async () => {
            handler.parse(REMOTE_SFU_DESCRIPTION, "remote");
            expect(handler.findMidBySsrc("2963372119", "remote")).toEqual("0");
        });
    });
});
