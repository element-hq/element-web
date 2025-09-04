/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { CallEventHandlerEvent } from "matrix-js-sdk/src/webrtc/callEventHandler";

import LegacyCallView from "../../../../../src/components/views/voip/LegacyCallView";
import LegacyCallViewForRoom from "../../../../../src/components/views/voip/LegacyCallViewForRoom";
import { mkStubRoom, stubClient } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import ResizeNotifier from "../../../../../src/utils/ResizeNotifier";
import LegacyCallHandler from "../../../../../src/LegacyCallHandler";

jest.mock("../../../../../src/components/views/voip/LegacyCallView", () => jest.fn(() => "LegacyCallView"));

describe("LegacyCallViewForRoom", () => {
    const LegacyCallViewMock = LegacyCallView as unknown as jest.Mock;
    beforeEach(() => {
        LegacyCallViewMock.mockClear();
    });
    it("should remember sidebar state, defaulting to shown", async () => {
        stubClient();

        const callHandler = new LegacyCallHandler();
        callHandler.start();
        jest.spyOn(LegacyCallHandler, "instance", "get").mockImplementation(() => callHandler);

        const call = new MatrixCall({
            client: MatrixClientPeg.safeGet(),
            roomId: "test-room",
        });
        DMRoomMap.setShared({
            getUserIdForRoomId: jest.fn().mockReturnValue("test-user"),
        } as unknown as DMRoomMap);

        const room = mkStubRoom(call.roomId, "room", MatrixClientPeg.safeGet());
        MatrixClientPeg.safeGet().getRoom = jest.fn().mockReturnValue(room);
        const cli = MatrixClientPeg.safeGet();
        cli.emit(CallEventHandlerEvent.Incoming, call);

        const { rerender } = render(
            <LegacyCallViewForRoom roomId={call.roomId} resizeNotifier={new ResizeNotifier()} />,
        );

        let props = LegacyCallViewMock.mock.lastCall![0];
        expect(props.sidebarShown).toBeTruthy(); // Sidebar defaults to shown

        props.setSidebarShown(false); // Hide the sidebar

        rerender(<LegacyCallViewForRoom roomId={call.roomId} resizeNotifier={new ResizeNotifier()} />);

        console.log(LegacyCallViewMock.mock);

        props = LegacyCallViewMock.mock.lastCall![0];
        expect(props.sidebarShown).toBeFalsy();

        rerender(<div> </div>); // Destroy the LegacyCallViewForRoom and LegacyCallView
        LegacyCallViewMock.mockClear(); // Drop stored LegacyCallView props

        rerender(<LegacyCallViewForRoom roomId={call.roomId} resizeNotifier={new ResizeNotifier()} />);

        props = LegacyCallViewMock.mock.lastCall![0];
        expect(props.sidebarShown).toBeFalsy(); // Value was remembered
    });
});
