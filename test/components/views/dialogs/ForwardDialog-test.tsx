/*
Copyright 2021 Robin Townsend <robin@robin.town>

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
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";
import { act } from "react-dom/test-utils";
import { MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { LocationAssetType, M_ASSET, M_LOCATION, M_TIMESTAMP } from "matrix-js-sdk/src/@types/location";
import { TEXT_NODE_TYPE } from "matrix-js-sdk/src/@types/extensible_events";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import ForwardDialog from "../../../../src/components/views/dialogs/ForwardDialog";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeLegacyLocationEvent,
    makeLocationEvent,
    mkEvent,
    mkMessage,
    mkStubRoom,
} from "../../../test-utils";
import { TILE_SERVER_WK_KEY } from "../../../../src/utils/WellKnownUtils";

describe("ForwardDialog", () => {
    const sourceRoom = "!111111111111111111:example.org";
    const aliceId = "@alice:example.org";
    const defaultMessage = mkMessage({
        room: sourceRoom,
        user: aliceId,
        msg: "Hello world!",
        event: true,
    });
    const accountDataEvent = new MatrixEvent({
        type: EventType.Direct,
        sender: aliceId,
        content: {},
    });
    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(aliceId),
        isGuest: jest.fn().mockReturnValue(false),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        getRoom: jest.fn(),
        getAccountData: jest.fn().mockReturnValue(accountDataEvent),
        getPushActionsForEvent: jest.fn(),
        mxcUrlToHttp: jest.fn().mockReturnValue(''),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        getProfileInfo: jest.fn().mockResolvedValue({
            displayname: 'Alice',
        }),
        decryptEventIfNeeded: jest.fn(),
        sendEvent: jest.fn(),
        getClientWellKnown: jest.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: 'maps.com' },
        }),
    });
    const defaultRooms = ["a", "A", "b"].map(name => mkStubRoom(name, name, mockClient));

    const mountForwardDialog = async (message = defaultMessage, rooms = defaultRooms) => {
        mockClient.getVisibleRooms.mockReturnValue(rooms);
        mockClient.getRoom.mockImplementation(roomId => rooms.find(room => room.roomId === roomId));

        let wrapper;
        await act(async () => {
            wrapper = mount(
                <ForwardDialog
                    matrixClient={mockClient}
                    event={message}
                    permalinkCreator={new RoomPermalinkCreator(undefined, sourceRoom)}
                    onFinished={jest.fn()}
                />,
            );
            // Wait one tick for our profile data to load so the state update happens within act
            await new Promise(resolve => setImmediate(resolve));
        });
        wrapper.update();

        return wrapper;
    };

    beforeEach(() => {
        DMRoomMap.makeShared();
        jest.clearAllMocks();
        mockClient.getUserId.mockReturnValue("@bob:example.org");
        mockClient.sendEvent.mockReset();
    });

    afterAll(() => {
        jest.spyOn(MatrixClientPeg, 'get').mockRestore();
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

        expect(wrapper.find("Entry")).toHaveLength(3);

        const searchInput = wrapper.find("SearchBox input");
        searchInput.instance().value = "a";
        searchInput.simulate("change");

        expect(wrapper.find("Entry")).toHaveLength(2);
    });

    it("tracks message sending progress across multiple rooms", async () => {
        const wrapper = await mountForwardDialog();

        // Make sendEvent require manual resolution so we can see the sending state
        let finishSend;
        let cancelSend;
        mockClient.sendEvent.mockImplementation(() => new Promise((resolve, reject) => {
            finishSend = resolve;
            cancelSend = reject;
        }));

        let firstButton;
        let secondButton;
        const update = () => {
            wrapper.update();
            firstButton = wrapper.find("AccessibleButton.mx_ForwardList_sendButton").first();
            secondButton = wrapper.find("AccessibleButton.mx_ForwardList_sendButton").at(1);
        };
        update();

        expect(firstButton.is(".mx_ForwardList_canSend")).toBe(true);

        act(() => { firstButton.simulate("click"); });
        update();
        expect(firstButton.is(".mx_ForwardList_sending")).toBe(true);

        await act(async () => {
            cancelSend();
            // Wait one tick for the button to realize the send failed
            await new Promise(resolve => setImmediate(resolve));
        });
        update();
        expect(firstButton.is(".mx_ForwardList_sendFailed")).toBe(true);

        expect(secondButton.is(".mx_ForwardList_canSend")).toBe(true);

        act(() => { secondButton.simulate("click"); });
        update();
        expect(secondButton.is(".mx_ForwardList_sending")).toBe(true);

        await act(async () => {
            finishSend();
            // Wait one tick for the button to realize the send succeeded
            await new Promise(resolve => setImmediate(resolve));
        });
        update();
        expect(secondButton.is(".mx_ForwardList_sent")).toBe(true);
    });

    it("can render replies", async () => {
        const replyMessage = mkEvent({
            type: "m.room.message",
            room: "!111111111111111111:example.org",
            user: "@alice:example.org",
            content: {
                "msgtype": "m.text",
                "body": "> <@bob:example.org> Hi Alice!\n\nHi Bob!",
                "m.relates_to": {
                    "m.in_reply_to": {
                        event_id: "$2222222222222222222222222222222222222222222",
                    },
                },
            },
            event: true,
        });

        const wrapper = await mountForwardDialog(replyMessage);
        expect(wrapper.find("ReplyChain")).toBeTruthy();
    });

    it("disables buttons for rooms without send permissions", async () => {
        const readOnlyRoom = mkStubRoom("a", "a", mockClient);
        readOnlyRoom.maySendMessage = jest.fn().mockReturnValue(false);
        const rooms = [readOnlyRoom, mkStubRoom("b", "b", mockClient)];

        const wrapper = await mountForwardDialog(undefined, rooms);

        const firstButton = wrapper.find("AccessibleButton.mx_ForwardList_sendButton").first();
        expect(firstButton.prop("disabled")).toBe(true);
        const secondButton = wrapper.find("AccessibleButton.mx_ForwardList_sendButton").last();
        expect(secondButton.prop("disabled")).toBe(false);
    });

    describe('Location events', () => {
        // 14.03.2022 16:15
        const now = 1647270879403;
        const roomId = "a";
        const geoUri = "geo:51.5076,-0.1276";
        const legacyLocationEvent = makeLegacyLocationEvent(geoUri);
        const modernLocationEvent = makeLocationEvent(geoUri);
        const pinDropLocationEvent = makeLocationEvent(geoUri, LocationAssetType.Pin);

        beforeEach(() => {
            // legacy events will default timestamp to Date.now()
            // mock a stable now for easy assertion
            jest.spyOn(Date, 'now').mockReturnValue(now);
        });

        afterAll(() => {
            jest.spyOn(Date, 'now').mockRestore();
        });

        const sendToFirstRoom = (wrapper: ReactWrapper): void =>
            act(() => {
                const sendToFirstRoomButton = wrapper.find("AccessibleButton.mx_ForwardList_sendButton").first();
                sendToFirstRoomButton.simulate("click");
            });

        it('converts legacy location events to pin drop shares', async () => {
            const wrapper = await mountForwardDialog(legacyLocationEvent);

            expect(wrapper.find('MLocationBody').length).toBeTruthy();
            sendToFirstRoom(wrapper);

            // text and description from original event are removed
            // text gets new default message from event values
            // timestamp is defaulted to now
            const text = `Location ${geoUri} at ${new Date(now).toISOString()}`;
            const expectedStrippedContent = {
                ...modernLocationEvent.getContent(),
                body: text,
                [TEXT_NODE_TYPE.name]: text,
                [M_TIMESTAMP.name]: now,
                [M_ASSET.name]: { type: LocationAssetType.Pin },
                [M_LOCATION.name]: {
                    uri: geoUri,
                    description: undefined,
                },
            };
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId, legacyLocationEvent.getType(), expectedStrippedContent,
            );
        });

        it('removes personal information from static self location shares', async () => {
            const wrapper = await mountForwardDialog(modernLocationEvent);

            expect(wrapper.find('MLocationBody').length).toBeTruthy();
            sendToFirstRoom(wrapper);

            const timestamp = M_TIMESTAMP.findIn<number>(modernLocationEvent.getContent());
            // text and description from original event are removed
            // text gets new default message from event values
            const text = `Location ${geoUri} at ${new Date(timestamp).toISOString()}`;
            const expectedStrippedContent = {
                ...modernLocationEvent.getContent(),
                body: text,
                [TEXT_NODE_TYPE.name]: text,
                [M_ASSET.name]: { type: LocationAssetType.Pin },
                [M_LOCATION.name]: {
                    uri: geoUri,
                    description: undefined,
                },
            };
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId, modernLocationEvent.getType(), expectedStrippedContent,
            );
        });

        it('forwards beacon location as a pin drop event', async () => {
            const timestamp = 123456;
            const beaconEvent = makeBeaconEvent('@alice:server.org', { geoUri, timestamp });
            const text = `Location ${geoUri} at ${new Date(timestamp).toISOString()}`;
            const expectedContent = {
                msgtype: "m.location",
                body: text,
                [TEXT_NODE_TYPE.name]: text,
                [M_ASSET.name]: { type: LocationAssetType.Pin },
                [M_LOCATION.name]: {
                    uri: geoUri,
                    description: undefined,
                },
                geo_uri: geoUri,
                [M_TIMESTAMP.name]: timestamp,
            };
            const wrapper = await mountForwardDialog(beaconEvent);

            expect(wrapper.find('MLocationBody').length).toBeTruthy();

            sendToFirstRoom(wrapper);

            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId, EventType.RoomMessage, expectedContent,
            );
        });

        it('forwards pin drop event', async () => {
            const wrapper = await mountForwardDialog(pinDropLocationEvent);

            expect(wrapper.find('MLocationBody').length).toBeTruthy();

            sendToFirstRoom(wrapper);

            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId, pinDropLocationEvent.getType(), pinDropLocationEvent.getContent(),
            );
        });
    });
});
