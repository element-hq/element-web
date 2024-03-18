/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import React from "react";
import { TooltipProvider } from "@vector-im/compound-web";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { mkRoom, mkRoomMember, stubClient, withClientContextRenderOptions } from "../../../test-utils";
import RoomFacePile from "../../../../src/components/views/elements/RoomFacePile";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

describe("<RoomFacePile />", () => {
    it("renders", () => {
        const cli = stubClient();
        DMRoomMap.makeShared(cli);
        const room = mkRoom(cli, "!123");

        jest.spyOn(room, "getJoinedMembers").mockReturnValue([
            mkRoomMember(room.roomId, "@bob:example.org", KnownMembership.Join),
        ]);

        const { asFragment } = render(
            <TooltipProvider>
                <RoomFacePile onlyKnownUsers={false} room={room} />
            </TooltipProvider>,
            withClientContextRenderOptions(MatrixClientPeg.get()!),
        );

        expect(asFragment()).toMatchSnapshot();
    });
});
