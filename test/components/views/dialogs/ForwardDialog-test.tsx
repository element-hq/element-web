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
import { MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { LocationAssetType, M_ASSET, M_LOCATION, M_TIMESTAMP } from "matrix-js-sdk/src/@types/location";
import { M_TEXT } from "matrix-js-sdk/src/@types/extensible_events";
import { act, fireEvent, getByTestId, render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
    mockPlatformPeg,
} from "../../../test-utils";
import { TILE_SERVER_WK_KEY } from "../../../../src/utils/WellKnownUtils";
import SettingsStore from "../../../../src/settings/SettingsStore";

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
        getSafeUserId: jest.fn().mockReturnValue(aliceId),
        isGuest: jest.fn().mockReturnValue(false),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        getRoom: jest.fn(),
        getAccountData: jest.fn().mockReturnValue(accountDataEvent),
        getPushActionsForEvent: jest.fn(),
        mxcUrlToHttp: jest.fn().mockReturnValue(""),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        getProfileInfo: jest.fn().mockResolvedValue({
            displayname: "Alice",
        }),
        decryptEventIfNeeded: jest.fn(),
        sendEvent: jest.fn(),
        getClientWellKnown: jest.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
        }),
    });
    const defaultRooms = ["a", "A", "b"].map((name) => mkStubRoom(name, name, mockClient));

    const mountForwardDialog = (message = defaultMessage, rooms = defaultRooms) => {
        mockClient.getVisibleRooms.mockReturnValue(rooms);
        mockClient.getRoom.mockImplementation((roomId) => rooms.find((room) => room.roomId === roomId) || null);

        const wrapper: RenderResult = render(
            <ForwardDialog
                matrixClient={mockClient}
                event={message}
                permalinkCreator={new RoomPermalinkCreator(undefined!, sourceRoom)}
                onFinished={jest.fn()}
            />,
        );

        return wrapper;
    };

    beforeEach(() => {
        DMRoomMap.makeShared(mockClient);
        jest.clearAllMocks();
        mockClient.getUserId.mockReturnValue("@bob:example.org");
        mockClient.getSafeUserId.mockReturnValue("@bob:example.org");
        mockClient.sendEvent.mockReset();
    });

    afterAll(() => {
        jest.spyOn(MatrixClientPeg, "get").mockRestore();
    });

    it("shows a preview with us as the sender", async () => {
        const { container } = mountForwardDialog();

        expect(screen.queryByText("Hello world!")).toBeInTheDocument();

        // We would just test SenderProfile for the user ID, but it's stubbed
        const previewAvatar = container.querySelector(".mx_EventTile_avatar .mx_BaseAvatar_image");
        expect(previewAvatar?.getAttribute("title")).toBe("@bob:example.org");
    });

    it("filters the rooms", async () => {
        const { container } = mountForwardDialog();

        expect(container.querySelectorAll(".mx_ForwardList_entry")).toHaveLength(3);

        const searchInput = getByTestId(container, "searchbox-input");
        act(() => userEvent.type(searchInput, "a"));

        expect(container.querySelectorAll(".mx_ForwardList_entry")).toHaveLength(3);
    });

    it("tracks message sending progress across multiple rooms", async () => {
        mockPlatformPeg();
        const { container } = mountForwardDialog();

        // Make sendEvent require manual resolution so we can see the sending state
        let finishSend: (arg?: any) => void;
        let cancelSend: () => void;
        mockClient.sendEvent.mockImplementation(
            <T extends {}>() =>
                new Promise<T>((resolve, reject) => {
                    finishSend = resolve;
                    cancelSend = reject;
                }),
        );

        let firstButton!: Element;
        let secondButton!: Element;
        const update = () => {
            [firstButton, secondButton] = container.querySelectorAll(".mx_ForwardList_sendButton");
        };
        update();

        expect(firstButton.className).toContain("mx_ForwardList_canSend");

        act(() => {
            fireEvent.click(firstButton);
        });
        update();
        expect(firstButton.className).toContain("mx_ForwardList_sending");

        await act(async () => {
            cancelSend();
            // Wait one tick for the button to realize the send failed
            await new Promise((resolve) => setImmediate(resolve));
        });
        update();
        expect(firstButton.className).toContain("mx_ForwardList_sendFailed");

        expect(secondButton.className).toContain("mx_ForwardList_canSend");

        act(() => {
            fireEvent.click(secondButton);
        });
        update();
        expect(secondButton.className).toContain("mx_ForwardList_sending");

        await act(async () => {
            finishSend();
            // Wait one tick for the button to realize the send succeeded
            await new Promise((resolve) => setImmediate(resolve));
        });
        update();
        expect(secondButton.className).toContain("mx_ForwardList_sent");
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

        mountForwardDialog(replyMessage);

        expect(screen.queryByText("Hi Alice!", { exact: false })).toBeInTheDocument();
    });

    it("disables buttons for rooms without send permissions", async () => {
        const readOnlyRoom = mkStubRoom("a", "a", mockClient);
        readOnlyRoom.maySendMessage = jest.fn().mockReturnValue(false);
        const rooms = [readOnlyRoom, mkStubRoom("b", "b", mockClient)];

        const { container } = mountForwardDialog(undefined, rooms);

        const [firstButton, secondButton] = container.querySelectorAll<HTMLButtonElement>(".mx_ForwardList_sendButton");

        expect(firstButton.getAttribute("aria-disabled")).toBeTruthy();
        expect(secondButton.getAttribute("aria-disabled")).toBeFalsy();
    });

    describe("Location events", () => {
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
            jest.spyOn(Date, "now").mockReturnValue(now);
        });

        afterAll(() => {
            jest.spyOn(Date, "now").mockRestore();
        });

        const sendToFirstRoom = (container: HTMLElement): void =>
            act(() => {
                const sendToFirstRoomButton = container.querySelector(".mx_ForwardList_sendButton");
                fireEvent.click(sendToFirstRoomButton!);
            });

        it("converts legacy location events to pin drop shares", async () => {
            const { container } = mountForwardDialog(legacyLocationEvent);

            expect(container.querySelector(".mx_MLocationBody")).toBeTruthy();
            sendToFirstRoom(container);

            // text and description from original event are removed
            // text gets new default message from event values
            // timestamp is defaulted to now
            const text = `Location ${geoUri} at ${new Date(now).toISOString()}`;
            const expectedStrippedContent = {
                ...modernLocationEvent.getContent(),
                body: text,
                [M_TEXT.name]: text,
                [M_TIMESTAMP.name]: now,
                [M_ASSET.name]: { type: LocationAssetType.Pin },
                [M_LOCATION.name]: {
                    uri: geoUri,
                },
            };
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId,
                legacyLocationEvent.getType(),
                expectedStrippedContent,
            );
        });

        it("removes personal information from static self location shares", async () => {
            const { container } = mountForwardDialog(modernLocationEvent);

            expect(container.querySelector(".mx_MLocationBody")).toBeTruthy();
            sendToFirstRoom(container);

            const timestamp = M_TIMESTAMP.findIn<number>(modernLocationEvent.getContent())!;
            // text and description from original event are removed
            // text gets new default message from event values
            const text = `Location ${geoUri} at ${new Date(timestamp).toISOString()}`;
            const expectedStrippedContent = {
                ...modernLocationEvent.getContent(),
                body: text,
                [M_TEXT.name]: text,
                [M_ASSET.name]: { type: LocationAssetType.Pin },
                [M_LOCATION.name]: {
                    uri: geoUri,
                },
            };
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId,
                modernLocationEvent.getType(),
                expectedStrippedContent,
            );
        });

        it("forwards beacon location as a pin drop event", async () => {
            const timestamp = 123456;
            const beaconEvent = makeBeaconEvent("@alice:server.org", { geoUri, timestamp });
            const text = `Location ${geoUri} at ${new Date(timestamp).toISOString()}`;
            const expectedContent = {
                msgtype: "m.location",
                body: text,
                [M_TEXT.name]: text,
                [M_ASSET.name]: { type: LocationAssetType.Pin },
                [M_LOCATION.name]: {
                    uri: geoUri,
                },
                geo_uri: geoUri,
                [M_TIMESTAMP.name]: timestamp,
            };
            const { container } = mountForwardDialog(beaconEvent);

            expect(container.querySelector(".mx_MLocationBody")).toBeTruthy();

            sendToFirstRoom(container);

            expect(mockClient.sendEvent).toHaveBeenCalledWith(roomId, EventType.RoomMessage, expectedContent);
        });

        it("forwards pin drop event", async () => {
            const { container } = mountForwardDialog(pinDropLocationEvent);

            expect(container.querySelector(".mx_MLocationBody")).toBeTruthy();

            sendToFirstRoom(container);

            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                roomId,
                pinDropLocationEvent.getType(),
                pinDropLocationEvent.getContent(),
            );
        });
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes through the dynamic predecessor setting", async () => {
            mockClient.getVisibleRooms.mockClear();
            mountForwardDialog();
            expect(mockClient.getVisibleRooms).toHaveBeenCalledWith(false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            mockClient.getVisibleRooms.mockClear();
            mountForwardDialog();
            expect(mockClient.getVisibleRooms).toHaveBeenCalledWith(true);
        });
    });
});
