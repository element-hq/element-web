/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { render } from "test-utils-rtl";
import { LOCAL_NOTIFICATION_SETTINGS_PREFIX, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import React from "react";

import IncomingLegacyCallToast from "./IncomingLegacyCallToast";
import DMRoomMap from "../utils/DMRoomMap";
import {
    clientAndSDKContextRenderOptions,
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    TestSDKContext,
} from "test-utils";

describe("<IncomingLegacyCallToast />", () => {
    const userId = "@alice:server.org";
    const deviceId = "my-device";

    vi.spyOn(DMRoomMap, "shared").mockReturnValue({
        getUserIdForRoomId: vi.fn(),
    } as unknown as DMRoomMap);

    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        getRoom: vi.fn(),
    });
    const sdkContext = new TestSDKContext();
    sdkContext._client = mockClient;
    const mockRoom = new Room("!room:server.org", mockClient, userId);
    mockClient.deviceId = deviceId;

    const call = new MatrixCall({ client: mockClient, roomId: mockRoom.roomId });
    const defaultProps = {
        call,
    };
    const getComponent = (props = {}) => <IncomingLegacyCallToast {...defaultProps} {...props} />;

    beforeEach(() => {
        vi.clearAllMocks();
        mockClient.getAccountData.mockReturnValue(undefined);
        mockClient.getRoom.mockReturnValue(mockRoom);
    });

    it("renders when silence button when call is not silenced", () => {
        const { getByLabelText } = render(getComponent(), clientAndSDKContextRenderOptions(mockClient, sdkContext));
        expect(getByLabelText("Silence call")).toMatchSnapshot();
    });

    it("renders sound on button when call is silenced", () => {
        sdkContext.legacyCallHandler.silenceCall(call.callId);
        const { getByLabelText } = render(getComponent(), clientAndSDKContextRenderOptions(mockClient, sdkContext));
        expect(getByLabelText("Sound on")).toMatchSnapshot();
    });

    it("renders disabled silenced button when call is forced to silent", () => {
        // silence local notifications -> force call ringer to silent
        mockClient.getAccountData.mockImplementation((eventType) => {
            if (eventType.includes(LOCAL_NOTIFICATION_SETTINGS_PREFIX.name)) {
                return new MatrixEvent({
                    type: eventType,
                    content: {
                        is_silenced: true,
                    },
                });
            }
        });
        const { getByLabelText } = render(getComponent(), clientAndSDKContextRenderOptions(mockClient, sdkContext));
        expect(getByLabelText("Notifications silenced")).toMatchSnapshot();
    });
});
