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
import { render } from "@testing-library/react";
import { LOCAL_NOTIFICATION_SETTINGS_PREFIX, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import React from "react";

import LegacyCallHandler from "../../src/LegacyCallHandler";
import IncomingLegacyCallToast from "../../src/toasts/IncomingLegacyCallToast";
import DMRoomMap from "../../src/utils/DMRoomMap";
import { getMockClientWithEventEmitter, mockClientMethodsServer, mockClientMethodsUser } from "../test-utils";

describe("<IncomingLegacyCallToast />", () => {
    const userId = "@alice:server.org";
    const deviceId = "my-device";

    jest.spyOn(DMRoomMap, "shared").mockReturnValue({
        getUserIdForRoomId: jest.fn(),
    } as unknown as DMRoomMap);

    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        getRoom: jest.fn(),
    });
    const mockRoom = new Room("!room:server.org", mockClient, userId);
    mockClient.deviceId = deviceId;

    const call = new MatrixCall({ client: mockClient, roomId: mockRoom.roomId });
    const defaultProps = {
        call,
    };
    const getComponent = (props = {}) => <IncomingLegacyCallToast {...defaultProps} {...props} />;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient.getAccountData.mockReturnValue(undefined);
        mockClient.getRoom.mockReturnValue(mockRoom);
    });

    it("renders when silence button when call is not silenced", () => {
        const { getByLabelText } = render(getComponent());
        expect(getByLabelText("Silence call")).toMatchSnapshot();
    });

    it("renders sound on button when call is silenced", () => {
        LegacyCallHandler.instance.silenceCall(call.callId);
        const { getByLabelText } = render(getComponent());
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
        const { getByLabelText } = render(getComponent());
        expect(getByLabelText("Notifications silenced")).toMatchSnapshot();
    });
});
