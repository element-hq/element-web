/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { type MatrixCall } from "matrix-js-sdk/src/matrix";
import { type CallFeed } from "matrix-js-sdk/src/webrtc/callFeed";
import { SDPStreamMetadataPurpose } from "matrix-js-sdk/src/webrtc/callEventTypes";

import LegacyCallView from "../../../../../src/components/views/voip/LegacyCallView";
import { stubClient } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";

describe("LegacyCallView", () => {
    it("should exit full screen on unmount", () => {
        const element = document.createElement("div");
        // @ts-expect-error
        document.fullscreenElement = element;
        document.exitFullscreen = jest.fn();

        stubClient();

        const call = {
            on: jest.fn(),
            removeListener: jest.fn(),
            getFeeds: jest.fn().mockReturnValue([]),
            isLocalOnHold: jest.fn().mockReturnValue(false),
            isRemoteOnHold: jest.fn().mockReturnValue(false),
            isMicrophoneMuted: jest.fn().mockReturnValue(false),
            isLocalVideoMuted: jest.fn().mockReturnValue(false),
            isScreensharing: jest.fn().mockReturnValue(false),
        } as unknown as MatrixCall;

        const { unmount } = render(<LegacyCallView call={call} sidebarShown={false} />);
        expect(document.exitFullscreen).not.toHaveBeenCalled();
        unmount();
        expect(document.exitFullscreen).toHaveBeenCalled();
    });

    it("should show/hide the sidebar based on the sidebarShown prop", async () => {
        stubClient();

        const call = {
            roomId: "test-room",
            on: jest.fn(),
            removeListener: jest.fn(),
            getFeeds: jest.fn().mockReturnValue(
                [{ local: true }, { local: false }, { local: true, screenshare: true }].map(
                    (x, i) =>
                        ({
                            stream: { id: "test-" + i },
                            addListener: jest.fn(),
                            removeListener: jest.fn(),
                            getMember: jest.fn(),
                            isAudioMuted: jest.fn().mockReturnValue(true),
                            isVideoMuted: jest.fn().mockReturnValue(true),
                            isLocal: jest.fn().mockReturnValue(x.local),
                            purpose: x.screenshare && SDPStreamMetadataPurpose.Screenshare,
                        }) as unknown as CallFeed,
                ),
            ),
            isLocalOnHold: jest.fn().mockReturnValue(false),
            isRemoteOnHold: jest.fn().mockReturnValue(false),
            isMicrophoneMuted: jest.fn().mockReturnValue(true),
            isLocalVideoMuted: jest.fn().mockReturnValue(true),
            isScreensharing: jest.fn().mockReturnValue(true),
            noIncomingFeeds: jest.fn().mockReturnValue(false),
            opponentSupportsSDPStreamMetadata: jest.fn().mockReturnValue(true),
        } as unknown as MatrixCall;
        DMRoomMap.setShared({
            getUserIdForRoomId: jest.fn().mockReturnValue("test-user"),
        } as unknown as DMRoomMap);

        const { container, rerender } = render(<LegacyCallView call={call} sidebarShown={true} />);
        expect(container.querySelector(".mx_LegacyCallViewSidebar")).toBeTruthy();
        rerender(<LegacyCallView call={call} sidebarShown={true} />);
        expect(container.querySelector(".mx_LegacyCallViewSidebar")).toBeTruthy();
    });

    it("should not show the sidebar button in picture-in-picture mode", async () => {
        stubClient();

        const call = {
            on: jest.fn(),
            removeListener: jest.fn(),
            getFeeds: jest.fn().mockReturnValue([]),
            isLocalOnHold: jest.fn().mockReturnValue(false),
            isRemoteOnHold: jest.fn().mockReturnValue(false),
            isMicrophoneMuted: jest.fn().mockReturnValue(false),
            isLocalVideoMuted: jest.fn().mockReturnValue(false),
            isScreensharing: jest.fn().mockReturnValue(false),
        } as unknown as MatrixCall;
        DMRoomMap.setShared({
            getUserIdForRoomId: jest.fn().mockReturnValue("test-user"),
        } as unknown as DMRoomMap);

        const { container } = render(<LegacyCallView call={call} sidebarShown={false} pipMode={true} />);
        expect(container.querySelector(".mx_LegacyCallViewButtons_button_sidebar")).toBeFalsy();
    });
});
