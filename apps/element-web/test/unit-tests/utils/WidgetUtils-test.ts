/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Oliver Sand
Copyright 2022 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import WidgetUtils from "../../../src/utils/WidgetUtils";
import { mockPlatformPeg } from "../../test-utils";

describe("getLocalJitsiWrapperUrl", () => {
    beforeEach(() => {
        Object.defineProperty(window, "location", {
            value: {
                origin: "https://app.element.io",
                pathname: "",
            },
        });
    });

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
