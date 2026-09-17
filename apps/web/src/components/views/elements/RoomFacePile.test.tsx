/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { render } from "test-utils-rtl";
import { mkRoom, mkRoomMember, stubClient, withClientContextRenderOptions } from "test-utils";
import React from "react";
import { KnownMembership } from "matrix-js-sdk/src/types";

import RoomFacePile from "./RoomFacePile";
import DMRoomMap from "../../../utils/DMRoomMap";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

describe("<RoomFacePile />", () => {
    it("renders", () => {
        const cli = stubClient();
        DMRoomMap.makeShared(cli);
        const room = mkRoom(cli, "!123");

        vi.spyOn(room, "getJoinedMembers").mockReturnValue([
            mkRoomMember(room.roomId, "@bob:example.org", KnownMembership.Join),
        ]);

        const { asFragment } = render(
            <RoomFacePile onlyKnownUsers={false} room={room} />,
            withClientContextRenderOptions(MatrixClientPeg.get()!),
        );

        expect(asFragment()).toMatchSnapshot();
    });
});
