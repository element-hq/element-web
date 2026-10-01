/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "test-utils-rtl";
import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { fireEvent } from "@testing-library/dom";
import { stubClient, TestSDKContext, withContexts } from "test-utils";

import RoomInfoLine from "./RoomInfoLine.tsx";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases.ts";

describe("RoomInfoLine", () => {
    it("renders for public room", () => {
        const cli = stubClient();
        const room = new Room("!roomId", cli, cli.getUserId()!);
        room.currentState.setStateEvents([
            new MatrixEvent({
                sender: cli.getUserId()!,
                room_id: room.roomId,
                state_key: "",
                event_id: "$eventId",
                type: "m.room.join_rules",
                content: {
                    join_rule: "public",
                },
            }),
        ]);

        const { asFragment, getByText } = render(<RoomInfoLine room={room} />);
        expect(getByText("Public room")).toBeVisible();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render members button which opens right panel", async () => {
        const sdkContext = new TestSDKContext();
        sdkContext._client = stubClient();
        const room = new Room("!roomId", sdkContext.client!, sdkContext.client!.getUserId()!);
        room.currentState.setStateEvents([
            new MatrixEvent({
                sender: sdkContext.client!.getUserId()!,
                room_id: room.roomId,
                state_key: "",
                event_id: "$eventId",
                type: "m.room.join_rules",
                content: {
                    join_rule: "public",
                },
            }),
        ]);
        vi.spyOn(room, "getJoinedMemberCount").mockReturnValue(50);

        vi.spyOn(sdkContext.rightPanelStore, "setCard");

        const { findByText } = render(<RoomInfoLine room={room} />, withContexts({ sdkContext }));
        fireEvent.click(await findByText("50 members"));
        expect(sdkContext.rightPanelStore.setCard).toHaveBeenCalledWith({ phase: RightPanelPhases.MemberList });
    });
});
