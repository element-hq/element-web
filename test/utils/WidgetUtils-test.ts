/*
Copyright 2022 Oliver Sand
Copyright 2022 Nordeck IT + Consulting GmbH.

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

import WidgetUtils from "../../src/utils/WidgetUtils";
import { mockPlatformPeg } from "../test-utils";

describe("getLocalJitsiWrapperUrl", () => {
    it("should generate jitsi URL (for defaults)", () => {
        mockPlatformPeg();

        expect(WidgetUtils.getLocalJitsiWrapperUrl()).toEqual(
            "https://app.element.io/jitsi.html" +
                "#conferenceDomain=$domain" +
                "&conferenceId=$conferenceId" +
                "&isAudioOnly=$isAudioOnly" +
                "&startWithAudioMuted=$startWithAudioMuted" +
                "&startWithVideoMuted=$startWithVideoMuted" +
                "&isVideoChannel=$isVideoChannel" +
                "&displayName=$matrix_display_name" +
                "&avatarUrl=$matrix_avatar_url" +
                "&userId=$matrix_user_id" +
                "&roomId=$matrix_room_id" +
                "&theme=$theme" +
                "&roomName=$roomName" +
                "&supportsScreensharing=true" +
                "&language=$org.matrix.msc2873.client_language",
        );
    });
});
