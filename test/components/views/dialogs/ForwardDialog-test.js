/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import "../../../skinned-sdk";

import React from "react";
import {configure, mount} from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import {act} from "react-dom/test-utils";

import * as TestUtils from "../../../test-utils";
import {MatrixClientPeg} from "../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import {RoomPermalinkCreator} from "../../../../src/utils/permalinks/Permalinks";
import ForwardDialog from "../../../../src/components/views/dialogs/ForwardDialog";

configure({ adapter: new Adapter() });

describe("ForwardDialog", () => {
    const sourceRoom = "!111111111111111111:example.org";
    const defaultMessage = TestUtils.mkMessage({
        room: sourceRoom,
        user: "@alice:example.org",
        msg: "Hello world!",
        event: true,
    });
    const defaultRooms = ["a", "A", "b"].map(name => TestUtils.mkStubRoom(name, name));

    const mountForwardDialog = async (message = defaultMessage, rooms = defaultRooms) => {
        const client = MatrixClientPeg.get();
        client.getVisibleRooms = jest.fn().mockReturnValue(rooms);

        let wrapper;
        await act(async () => {
            wrapper = mount(
                <ForwardDialog
                    cli={client}
                    event={message}
                    permalinkCreator={new RoomPermalinkCreator(undefined, sourceRoom)}
                    onFinished={jest.fn()}
                />,
            );
            // Wait one tick for our profile data to load so the state update happens within act
            await new Promise(resolve => setImmediate(resolve));
        });

        return wrapper;
    };

    beforeEach(() => {
        TestUtils.stubClient();
        DMRoomMap.makeShared();
        MatrixClientPeg.get().getUserId = jest.fn().mockReturnValue("@bob:example.org");
    });

    it("shows a preview with us as the sender", async () => {
        const wrapper = await mountForwardDialog();

        const previewBody = wrapper.find(".mx_EventTile_body");
        expect(previewBody.text()).toBe("Hello world!");

        // We would just test SenderProfile for the user ID, but it's stubbed
        const previewAvatar = wrapper.find(".mx_EventTile_avatar .mx_BaseAvatar_image");
        expect(previewAvatar.prop("title")).toBe("@bob:example.org");
    });

    it("filters the rooms", async () => {
        const wrapper = await mountForwardDialog();

        const roomsBefore = wrapper.find(".mx_ForwardList_entry");
        expect(roomsBefore).toHaveLength(3);

        const searchInput = wrapper.find(".mx_SearchBox input");
        searchInput.instance().value = "a";
        searchInput.simulate("change");

        const roomsAfter = wrapper.find(".mx_ForwardList_entry");
        expect(roomsAfter).toHaveLength(2);
    });

    it("tracks message sending progress across multiple rooms", async () => {
        const wrapper = await mountForwardDialog();

        // Make sendEvent require manual resolution so we can see the sending state
        let finishSend;
        let cancelSend;
        MatrixClientPeg.get().sendEvent = jest.fn(() => new Promise((resolve, reject) => {
            finishSend = resolve;
            cancelSend = reject;
        }));

        const firstRoom = wrapper.find(".mx_ForwardList_entry").first();
        expect(firstRoom.find(".mx_AccessibleButton").text()).toBe("Send");

        act(() => {
            firstRoom.find(".mx_AccessibleButton").simulate("click");
        });
        expect(firstRoom.find(".mx_AccessibleButton").text()).toBe("Sending…");

        await act(async () => {
            cancelSend();
            // Wait one tick for the button to realize the send failed
            await new Promise(resolve => setImmediate(resolve));
        });
        expect(firstRoom.find(".mx_AccessibleButton").text()).toBe("Failed to send");

        const secondRoom = wrapper.find(".mx_ForwardList_entry").at(1);
        expect(secondRoom.find(".mx_AccessibleButton").text()).toBe("Send");

        act(() => {
            secondRoom.find(".mx_AccessibleButton").simulate("click");
        });
        expect(secondRoom.find(".mx_AccessibleButton").text()).toBe("Sending…");

        await act(async () => {
            finishSend();
            // Wait one tick for the button to realize the send succeeded
            await new Promise(resolve => setImmediate(resolve));
        });
        expect(secondRoom.find(".mx_AccessibleButton").text()).toBe("Sent");
    });

    it("can render replies", async () => {
        const replyMessage = TestUtils.mkEvent({
            type: "m.room.message",
            room: "!111111111111111111:example.org",
            user: "@alice:example.org",
            content: {
                msgtype: "m.text",
                body: "> <@bob:example.org> Hi Alice!\n\nHi Bob!",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: "$2222222222222222222222222222222222222222222",
                    },
                },
            },
            event: true,
        });

        const wrapper = await mountForwardDialog(replyMessage);
        expect(wrapper.find("ReplyThread")).toBeTruthy();
    });
});
