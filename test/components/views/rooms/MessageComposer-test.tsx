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

import * as React from "react";
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { createTestClient, mkEvent, mkStubRoom, stubClient } from "../../../test-utils";
import MessageComposer from "../../../../src/components/views/rooms/MessageComposer";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import RoomContext from "../../../../src/contexts/RoomContext";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { LocalRoom } from "../../../../src/models/LocalRoom";
import MessageComposerButtons from "../../../../src/components/views/rooms/MessageComposerButtons";

describe("MessageComposer", () => {
    stubClient();
    const cli = createTestClient();

    describe("for a Room", () => {
        const room = mkStubRoom("!roomId:server", "Room 1", cli);

        it("Renders a SendMessageComposer and MessageComposerButtons by default", () => {
            const wrapper = wrapAndRender({ room });

            expect(wrapper.find("SendMessageComposer")).toHaveLength(1);
            expect(wrapper.find("MessageComposerButtons")).toHaveLength(1);
        });

        it("Does not render a SendMessageComposer or MessageComposerButtons when user has no permission", () => {
            const wrapper = wrapAndRender({ room }, false);

            expect(wrapper.find("SendMessageComposer")).toHaveLength(0);
            expect(wrapper.find("MessageComposerButtons")).toHaveLength(0);
            expect(wrapper.find(".mx_MessageComposer_noperm_error")).toHaveLength(1);
        });

        it("Does not render a SendMessageComposer or MessageComposerButtons when room is tombstoned", () => {
            const wrapper = wrapAndRender({ room }, true, mkEvent({
                event: true,
                type: "m.room.tombstone",
                room: room.roomId,
                user: "@user1:server",
                skey: "",
                content: {},
                ts: Date.now(),
            }));

            expect(wrapper.find("SendMessageComposer")).toHaveLength(0);
            expect(wrapper.find("MessageComposerButtons")).toHaveLength(0);
            expect(wrapper.find(".mx_MessageComposer_roomReplaced_header")).toHaveLength(1);
        });
    });

    describe("for a LocalRoom", () => {
        const localRoom = new LocalRoom("!room:example.com", cli, cli.getUserId());

        it("should pass the sticker picker disabled prop", () => {
            const wrapper = wrapAndRender({ room: localRoom });
            expect(wrapper.find(MessageComposerButtons).props().showStickersButton).toBe(false);
        });
    });
});

function wrapAndRender(
    props: Partial<React.ComponentProps<typeof MessageComposer>> = {},
    canSendMessages = true,
    tombstone?: MatrixEvent,
): ReactWrapper {
    const mockClient = MatrixClientPeg.get();
    const roomId = "myroomid";
    const room: any = props.room || {
        currentState: undefined,
        roomId,
        client: mockClient,
        getMember: function(userId: string): RoomMember {
            return new RoomMember(roomId, userId);
        },
    };

    const roomState = {
        room, canSendMessages, tombstone,
    } as unknown as IRoomState;

    const defaultProps = {
        room,
        resizeNotifier: new ResizeNotifier(),
        permalinkCreator: new RoomPermalinkCreator(room),
    };

    return mount(
        <MatrixClientContext.Provider value={mockClient}>
            <RoomContext.Provider value={roomState}>
                <MessageComposer {...defaultProps} {...props} />
            </RoomContext.Provider>
        </MatrixClientContext.Provider>,
    );
}
