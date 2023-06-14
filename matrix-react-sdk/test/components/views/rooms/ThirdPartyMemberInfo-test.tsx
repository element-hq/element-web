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

import React from "react";
import { render, screen } from "@testing-library/react";
import { EventType, IEvent, MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";

import ThirdPartyMemberInfo from "../../../../src/components/views/rooms/ThirdPartyMemberInfo";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../test-utils";

describe("<ThirdPartyMemberInfo />", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
    });

    // make invite event with defaults
    const makeInviteEvent = (props: Partial<IEvent> = {}): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomThirdPartyInvite,
            state_key: "123456",
            sender: userId,
            room_id: roomId,
            content: {
                display_name: "bob@bob.com",
                key_validity_url: "https://isthiskeyvalid.org",
                public_key: "abc123",
            },
            ...props,
        });
    const defaultEvent = makeInviteEvent();

    const getComponent = (event: MatrixEvent = defaultEvent) => render(<ThirdPartyMemberInfo event={event} />);
    const room = new Room(roomId, mockClient, userId);
    const aliceMember = new RoomMember(roomId, userId);
    aliceMember.name = "Alice DisplayName";

    beforeEach(() => {
        jest.spyOn(room, "getMember").mockImplementation((id) => (id === userId ? aliceMember : null));
        mockClient.getRoom.mockClear().mockReturnValue(room);
    });

    it("should render invite", () => {
        const { container } = getComponent();
        expect(container).toMatchSnapshot();
    });

    it("should render invite when room in not available", () => {
        const event = makeInviteEvent({ room_id: "not_available" });
        const { container } = getComponent(event);
        expect(container).toMatchSnapshot();
    });

    it("should use inviter's id when room member is not available", () => {
        const event = makeInviteEvent({ sender: "@charlie:server.org" });
        getComponent(event);

        expect(screen.getByText("Invited by @charlie:server.org")).toBeInTheDocument();
    });
});
