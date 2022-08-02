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

import React from "react";
// eslint-disable-next-line deprecate/import
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import {
    stubClient,
    stubVideoChannelStore,
    StubVideoChannelStore,
    mkRoom,
    mkVideoChannelMember,
    mockStateEventImplementation,
} from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import FacePile from "../../../../src/components/views/elements/FacePile";
import MemberAvatar from "../../../../src/components/views/avatars/MemberAvatar";
import VideoLobby from "../../../../src/components/views/voip/VideoLobby";

describe("VideoLobby", () => {
    Object.defineProperty(navigator, "mediaDevices", {
        value: {
            enumerateDevices: jest.fn(),
            getUserMedia: () => null,
        },
    });
    jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    let cli: MatrixClient;
    let store: StubVideoChannelStore;
    let room: Room;
    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.get();
        store = stubVideoChannelStore();
        room = mkRoom(cli, "!1:example.org");
        mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([]);
    });

    describe("connected members", () => {
        it("hides when no one is connected", async () => {
            const lobby = mount(<VideoLobby room={room} />);
            // Wait for state to settle
            await act(() => Promise.resolve());
            lobby.update();

            expect(lobby.find(".mx_VideoLobby_connectedMembers").exists()).toEqual(false);
        });

        it("is shown when someone is connected", async () => {
            mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([
                // A user connected from 2 devices
                mkVideoChannelMember("@alice:example.org", ["device 1", "device 2"]),
                // A disconnected user
                mkVideoChannelMember("@bob:example.org", []),
                // A user that claims to have a connected device, but has left the room
                mkVideoChannelMember("@chris:example.org", ["device 1"]),
            ]));

            mocked(room).getMember.mockImplementation(userId => ({
                userId,
                membership: userId === "@chris:example.org" ? "leave" : "join",
                name: userId,
                rawDisplayName: userId,
                roomId: "!1:example.org",
                getAvatarUrl: () => {},
                getMxcAvatarUrl: () => {},
            }) as unknown as RoomMember);

            const lobby = mount(<VideoLobby room={room} />);
            // Wait for state to settle
            await act(() => Promise.resolve());
            lobby.update();

            // Only Alice should display as connected
            const memberText = lobby.find(".mx_VideoLobby_connectedMembers").children().at(0).text();
            expect(memberText).toEqual("1 person joined");
            expect(lobby.find(FacePile).find(MemberAvatar).props().member.userId).toEqual("@alice:example.org");
        });

        it("doesn't include remote echo of this device being connected", async () => {
            mocked(room.currentState).getStateEvents.mockImplementation(mockStateEventImplementation([
                // Make the remote echo claim that we're connected, while leaving the store disconnected
                mkVideoChannelMember(cli.getUserId(), [cli.getDeviceId()]),
            ]));

            mocked(room).getMember.mockImplementation(userId => ({
                userId,
                membership: "join",
                name: userId,
                rawDisplayName: userId,
                roomId: "!1:example.org",
                getAvatarUrl: () => {},
                getMxcAvatarUrl: () => {},
            }) as unknown as RoomMember);

            const lobby = mount(<VideoLobby room={room} />);
            // Wait for state to settle
            await act(() => Promise.resolve());
            lobby.update();

            // Because of our local echo, we should still appear as disconnected
            expect(lobby.find(".mx_VideoLobby_connectedMembers").exists()).toEqual(false);
        });
    });

    describe("device buttons", () => {
        it("hides when no devices are available", async () => {
            const lobby = mount(<VideoLobby room={room} />);
            // Wait for state to settle
            await act(() => Promise.resolve());
            lobby.update();

            expect(lobby.find("DeviceButton").children().exists()).toEqual(false);
        });

        it("hides device list when only one device is available", async () => {
            mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([{
                deviceId: "1",
                groupId: "1",
                label: "Webcam",
                kind: "videoinput",
                toJSON: () => {},
            }]);

            const lobby = mount(<VideoLobby room={room} />);
            // Wait for state to settle
            await act(() => Promise.resolve());
            lobby.update();

            expect(lobby.find(".mx_VideoLobby_deviceListButton").exists()).toEqual(false);
        });

        it("shows device list when multiple devices are available", async () => {
            mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
                {
                    deviceId: "1",
                    groupId: "1",
                    label: "Front camera",
                    kind: "videoinput",
                    toJSON: () => {},
                },
                {
                    deviceId: "2",
                    groupId: "1",
                    label: "Back camera",
                    kind: "videoinput",
                    toJSON: () => {},
                },
            ]);

            const lobby = mount(<VideoLobby room={room} />);
            // Wait for state to settle
            await act(() => Promise.resolve());
            lobby.update();

            expect(lobby.find(".mx_VideoLobby_deviceListButton").exists()).toEqual(true);
        });
    });

    describe("join button", () => {
        it("works", async () => {
            const lobby = mount(<VideoLobby room={room} />);
            // Wait for state to settle
            await act(() => Promise.resolve());
            lobby.update();

            act(() => {
                lobby.find("AccessibleButton.mx_VideoLobby_joinButton").simulate("click");
            });
            expect(store.connect).toHaveBeenCalled();
        });
    });
});
