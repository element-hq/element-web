/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect } from "vitest";
import { render, fireEvent } from "test-utils-rtl";
import { type MatrixCall } from "matrix-js-sdk/src/matrix";
import { type CallFeed } from "matrix-js-sdk/src/webrtc/callFeed";
import { SDPStreamMetadataPurpose } from "matrix-js-sdk/src/webrtc/callEventTypes";
import { clientAndSDKContextRenderOptions, createTestClient, stubClient, TestSDKContext } from "test-utils";

import LegacyCallView from "./LegacyCallView";
import DMRoomMap from "../../../utils/DMRoomMap";

describe("LegacyCallView", () => {
    const cli = stubClient();
    const sdkContext = new TestSDKContext();
    sdkContext._client = cli;

    it("should exit full screen on unmount", () => {
        const element = document.createElement("div");
        // @ts-expect-error
        document.fullscreenElement = element;
        document.exitFullscreen = vi.fn();

        const call = {
            on: vi.fn(),
            removeListener: vi.fn(),
            getFeeds: vi.fn().mockReturnValue([]),
            isLocalOnHold: vi.fn().mockReturnValue(false),
            isRemoteOnHold: vi.fn().mockReturnValue(false),
            isMicrophoneMuted: vi.fn().mockReturnValue(false),
            isLocalVideoMuted: vi.fn().mockReturnValue(false),
            isScreensharing: vi.fn().mockReturnValue(false),
        } as unknown as MatrixCall;

        const { unmount } = render(
            <LegacyCallView call={call} sidebarShown={false} />,
            clientAndSDKContextRenderOptions(cli, sdkContext),
        );
        expect(document.exitFullscreen).not.toHaveBeenCalled();
        unmount();
        expect(document.exitFullscreen).toHaveBeenCalled();
    });

    it("should show/hide the sidebar based on the sidebarShown prop", async () => {
        const cli = stubClient();
        const call = {
            roomId: "test-room",
            on: vi.fn(),
            removeListener: vi.fn(),
            getFeeds: vi.fn().mockReturnValue(
                [{ local: true }, { local: false }, { local: true, screenshare: true }].map(
                    (x, i) =>
                        ({
                            stream: { id: "test-" + i },
                            addListener: vi.fn(),
                            removeListener: vi.fn(),
                            getMember: vi.fn(),
                            isAudioMuted: vi.fn().mockReturnValue(true),
                            isVideoMuted: vi.fn().mockReturnValue(true),
                            isLocal: vi.fn().mockReturnValue(x.local),
                            purpose: x.screenshare && SDPStreamMetadataPurpose.Screenshare,
                        }) as unknown as CallFeed,
                ),
            ),
            isLocalOnHold: vi.fn().mockReturnValue(false),
            isRemoteOnHold: vi.fn().mockReturnValue(false),
            isMicrophoneMuted: vi.fn().mockReturnValue(true),
            isLocalVideoMuted: vi.fn().mockReturnValue(true),
            isScreensharing: vi.fn().mockReturnValue(true),
            noIncomingFeeds: vi.fn().mockReturnValue(false),
            opponentSupportsSDPStreamMetadata: vi.fn().mockReturnValue(true),
        } as unknown as MatrixCall;
        DMRoomMap.setShared({
            getUserIdForRoomId: vi.fn().mockReturnValue("test-user"),
        } as unknown as DMRoomMap);

        const { container, rerender } = render(
            <LegacyCallView call={call} sidebarShown={true} />,
            clientAndSDKContextRenderOptions(cli, sdkContext),
        );
        expect(container.querySelector(".mx_LegacyCallViewSidebar")).toBeTruthy();
        rerender(<LegacyCallView call={call} sidebarShown={true} />);
        expect(container.querySelector(".mx_LegacyCallViewSidebar")).toBeTruthy();
    });

    it("should not show the sidebar button in picture-in-picture mode", async () => {
        const cli = stubClient();
        const call = {
            on: vi.fn(),
            removeListener: vi.fn(),
            getFeeds: vi.fn().mockReturnValue([]),
            isLocalOnHold: vi.fn().mockReturnValue(false),
            isRemoteOnHold: vi.fn().mockReturnValue(false),
            isMicrophoneMuted: vi.fn().mockReturnValue(false),
            isLocalVideoMuted: vi.fn().mockReturnValue(false),
            isScreensharing: vi.fn().mockReturnValue(false),
        } as unknown as MatrixCall;
        DMRoomMap.setShared({
            getUserIdForRoomId: vi.fn().mockReturnValue("test-user"),
        } as unknown as DMRoomMap);

        const { container } = render(
            <LegacyCallView call={call} sidebarShown={false} pipMode={true} />,
            clientAndSDKContextRenderOptions(cli, sdkContext),
        );
        expect(container.querySelector(".mx_LegacyCallViewButtons_button_sidebar")).toBeFalsy();
    });

    it("should allow user to resume held call", async () => {
        const client = createTestClient();
        const sdkContext = new TestSDKContext();
        sdkContext._client = client;

        const call = {
            roomId: "test-room",
            on: vi.fn(),
            removeListener: vi.fn(),
            getFeeds: vi.fn().mockReturnValue(
                [{ local: true }, { local: false }, { local: true, screenshare: true }].map(
                    (x, i) =>
                        ({
                            stream: { id: "test-" + i },
                            addListener: vi.fn(),
                            removeListener: vi.fn(),
                            getMember: vi.fn(),
                            isAudioMuted: vi.fn().mockReturnValue(true),
                            isVideoMuted: vi.fn().mockReturnValue(true),
                            isLocal: vi.fn().mockReturnValue(x.local),
                            purpose: x.screenshare && SDPStreamMetadataPurpose.Screenshare,
                        }) as unknown as CallFeed,
                ),
            ),
            isLocalOnHold: vi.fn().mockReturnValue(false),
            isRemoteOnHold: vi.fn().mockReturnValue(true),
            isMicrophoneMuted: vi.fn().mockReturnValue(true),
            isLocalVideoMuted: vi.fn().mockReturnValue(true),
            isScreensharing: vi.fn().mockReturnValue(true),
            noIncomingFeeds: vi.fn().mockReturnValue(false),
            opponentSupportsSDPStreamMetadata: vi.fn().mockReturnValue(true),
            getOpponentMember: vi.fn(),
        } as unknown as MatrixCall;

        vi.spyOn(sdkContext.legacyCallHandler, "roomIdForCall").mockReturnValue(call.roomId);
        vi.spyOn(sdkContext.legacyCallHandler, "setActiveCallRoomId");

        const { getByText } = render(
            <LegacyCallView call={call} sidebarShown />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        fireEvent.click(getByText("Resume"));

        expect(sdkContext.legacyCallHandler.setActiveCallRoomId).toHaveBeenCalledWith(call.roomId);
    });

    it("should allow user to hangup call", async () => {
        const client = createTestClient();
        const sdkContext = new TestSDKContext();
        sdkContext._client = client;

        const call = {
            roomId: "test-room",
            on: vi.fn(),
            removeListener: vi.fn(),
            getFeeds: vi.fn().mockReturnValue(
                [{ local: true }, { local: false }, { local: true, screenshare: true }].map(
                    (x, i) =>
                        ({
                            stream: { id: "test-" + i },
                            addListener: vi.fn(),
                            removeListener: vi.fn(),
                            getMember: vi.fn(),
                            isAudioMuted: vi.fn().mockReturnValue(true),
                            isVideoMuted: vi.fn().mockReturnValue(true),
                            isLocal: vi.fn().mockReturnValue(x.local),
                            purpose: x.screenshare && SDPStreamMetadataPurpose.Screenshare,
                        }) as unknown as CallFeed,
                ),
            ),
            isLocalOnHold: vi.fn().mockReturnValue(false),
            isRemoteOnHold: vi.fn().mockReturnValue(false),
            isMicrophoneMuted: vi.fn().mockReturnValue(true),
            isLocalVideoMuted: vi.fn().mockReturnValue(true),
            isScreensharing: vi.fn().mockReturnValue(true),
            noIncomingFeeds: vi.fn().mockReturnValue(false),
            opponentSupportsSDPStreamMetadata: vi.fn().mockReturnValue(true),
            getOpponentMember: vi.fn(),
        } as unknown as MatrixCall;

        vi.spyOn(sdkContext.legacyCallHandler, "roomIdForCall").mockReturnValue(call.roomId);
        vi.spyOn(sdkContext.legacyCallHandler, "hangupOrReject");

        const { getByLabelText } = render(
            <LegacyCallView call={call} sidebarShown />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        fireEvent.click(getByLabelText("Hangup"));

        expect(sdkContext.legacyCallHandler.hangupOrReject).toHaveBeenCalledWith(call.roomId);
    });
});
