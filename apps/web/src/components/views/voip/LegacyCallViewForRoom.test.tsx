/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, beforeEach, type Mock } from "vitest";
import { fireEvent, render, waitFor } from "test-utils-rtl";
import { MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import { CallEventHandlerEvent } from "matrix-js-sdk/src/webrtc/callEventHandler";
import { clientAndSDKContextRenderOptions, mkStubRoom, stubClient, TestSDKContext } from "test-utils";

import LegacyCallView from "./LegacyCallView";
import LegacyCallViewForRoom from "./LegacyCallViewForRoom";
import DMRoomMap from "../../../utils/DMRoomMap";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import LegacyCallHandler from "../../../LegacyCallHandler";

vi.mock("./LegacyCallView", () => ({ default: vi.fn(() => "LegacyCallView") }));

describe("LegacyCallViewForRoom", () => {
    const LegacyCallViewMock = LegacyCallView as unknown as Mock;
    let sdkContext: TestSDKContext;

    beforeEach(() => {
        sdkContext = new TestSDKContext();
        sdkContext._client = stubClient();
        LegacyCallViewMock.mockClear();
    });

    it("should remember sidebar state, defaulting to shown", async () => {
        const callHandler = new LegacyCallHandler(sdkContext);
        callHandler.start();
        sdkContext._LegacyCallHandler = callHandler;

        const call = new MatrixCall({
            client: MatrixClientPeg.safeGet(),
            roomId: "test-room",
        });
        DMRoomMap.setShared({
            getUserIdForRoomId: vi.fn().mockReturnValue("test-user"),
        } as unknown as DMRoomMap);

        const room = mkStubRoom(call.roomId, "room", MatrixClientPeg.safeGet());
        MatrixClientPeg.safeGet().getRoom = vi.fn().mockReturnValue(room);
        const cli = MatrixClientPeg.safeGet();
        cli.emit(CallEventHandlerEvent.Incoming, call);

        const { rerender } = render(
            <LegacyCallViewForRoom roomId={call.roomId} />,
            clientAndSDKContextRenderOptions(cli, sdkContext),
        );

        let props = LegacyCallViewMock.mock.lastCall![0];
        expect(props.sidebarShown).toBeTruthy(); // Sidebar defaults to shown

        props.setSidebarShown(false); // Hide the sidebar

        rerender(<LegacyCallViewForRoom roomId={call.roomId} />);

        console.log(LegacyCallViewMock.mock);

        props = LegacyCallViewMock.mock.lastCall![0];
        expect(props.sidebarShown).toBeFalsy();

        rerender(<div> </div>); // Destroy the LegacyCallViewForRoom and LegacyCallView
        LegacyCallViewMock.mockClear(); // Drop stored LegacyCallView props

        rerender(<LegacyCallViewForRoom roomId={call.roomId} />);

        props = LegacyCallViewMock.mock.lastCall![0];
        expect(props.sidebarShown).toBeFalsy(); // Value was remembered
    });

    it("should notify on resize start events", async () => {
        const call = new MatrixCall({
            client: MatrixClientPeg.safeGet(),
            roomId: "test-room",
        });

        const callHandler = {
            getCallForRoom: vi.fn().mockReturnValue(call),
            isCallSidebarShown: vi.fn().mockReturnValue(true),
            addListener: vi.fn(),
            removeListener: vi.fn(),
        };
        sdkContext._LegacyCallHandler = callHandler as unknown as LegacyCallHandler;

        vi.spyOn(sdkContext.resizeNotifier, "startResizing");
        vi.spyOn(sdkContext.resizeNotifier, "stopResizing");
        vi.spyOn(sdkContext.resizeNotifier, "notifyTimelineHeightChanged");

        const { container } = render(
            <LegacyCallViewForRoom roomId={call.roomId} />,
            clientAndSDKContextRenderOptions(sdkContext.client!, sdkContext),
        );

        const resizer = container.querySelector(".mx_LegacyCallViewForRoom_ResizeHandle");
        await waitFor(() => {
            expect(resizer).toBeInTheDocument();
        });

        fireEvent.mouseDown(resizer!);
        fireEvent.mouseMove(resizer!, { clientY: 100 });
        fireEvent.mouseUp(resizer!);

        expect(sdkContext.resizeNotifier.startResizing).toHaveBeenCalled();
        expect(sdkContext.resizeNotifier.stopResizing).toHaveBeenCalled();
        expect(sdkContext.resizeNotifier.notifyTimelineHeightChanged).toHaveBeenCalled();
    });
});
