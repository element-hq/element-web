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
import { render, screen } from "@testing-library/react";
import { RoomType } from "matrix-js-sdk/src/@types/event";
import { Room } from "matrix-js-sdk/src/matrix";

import InviteDialog from "../../../../src/components/views/dialogs/InviteDialog";
import { KIND_DM, KIND_INVITE } from "../../../../src/components/views/dialogs/InviteDialogTypes";
import { getMockClientWithEventEmitter, mkMembership, mkMessage, mkRoomCreateEvent } from "../../../test-utils";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import SdkConfig from "../../../../src/SdkConfig";
import { ValidatedServerConfig } from "../../../../src/utils/ValidatedServerConfig";
import { IConfigOptions } from "../../../../src/IConfigOptions";

const mockGetAccessToken = jest.fn().mockResolvedValue("getAccessToken");
jest.mock("../../../../src/IdentityAuthClient", () =>
    jest.fn().mockImplementation(() => ({
        getAccessToken: mockGetAccessToken,
    })),
);

describe("InviteDialog", () => {
    const roomId = "!111111111111111111:example.org";
    const aliceId = "@alice:example.org";
    const aliceEmail = "foobar@email.com";
    const bobId = "@bob:example.org";
    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(bobId),
        getSafeUserId: jest.fn().mockReturnValue(bobId),
        isGuest: jest.fn().mockReturnValue(false),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        getRoom: jest.fn(),
        getRooms: jest.fn(),
        getAccountData: jest.fn(),
        getPushActionsForEvent: jest.fn(),
        mxcUrlToHttp: jest.fn().mockReturnValue(""),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        getProfileInfo: jest.fn().mockRejectedValue({ errcode: "" }),
        getIdentityServerUrl: jest.fn(),
        searchUserDirectory: jest.fn().mockResolvedValue({}),
        lookupThreePid: jest.fn(),
        registerWithIdentityServer: jest.fn().mockResolvedValue({
            access_token: "access_token",
            token: "token",
        }),
        getOpenIdToken: jest.fn().mockResolvedValue({}),
        getIdentityAccount: jest.fn().mockResolvedValue({}),
        getTerms: jest.fn().mockResolvedValue({ policies: [] }),
        supportsThreads: jest.fn().mockReturnValue(false),
        isInitialSyncComplete: jest.fn().mockReturnValue(true),
    });
    let room: Room;

    beforeEach(() => {
        SdkConfig.put({ validated_server_config: {} as ValidatedServerConfig } as IConfigOptions);
        DMRoomMap.makeShared();
        jest.clearAllMocks();
        mockClient.getUserId.mockReturnValue(bobId);

        room = new Room(roomId, mockClient, mockClient.getSafeUserId());
        room.addLiveEvents([
            mkMessage({
                msg: "Hello",
                relatesTo: undefined,
                event: true,
                room: roomId,
                user: mockClient.getSafeUserId(),
                ts: Date.now(),
            }),
        ]);
        room.currentState.setStateEvents([
            mkRoomCreateEvent(bobId, roomId),
            mkMembership({
                event: true,
                room: roomId,
                mship: "join",
                user: aliceId,
                skey: aliceId,
            }),
        ]);
        jest.spyOn(DMRoomMap.shared(), "getUniqueRoomsWithIndividuals").mockReturnValue({
            [aliceId]: room,
        });
        mockClient.getRooms.mockReturnValue([room]);
        mockClient.getRoom.mockReturnValue(room);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("should label with space name", () => {
        room.isSpaceRoom = jest.fn().mockReturnValue(true);
        room.getType = jest.fn().mockReturnValue(RoomType.Space);
        room.name = "Space";
        render(<InviteDialog kind={KIND_INVITE} roomId={roomId} onFinished={jest.fn()} />);

        expect(screen.queryByText("Invite to Space")).toBeTruthy();
    });

    it("should label with room name", () => {
        render(<InviteDialog kind={KIND_INVITE} roomId={roomId} onFinished={jest.fn()} />);
        expect(screen.getByText(`Invite to ${roomId}`)).toBeInTheDocument();
    });

    it("should suggest valid MXIDs even if unknown", async () => {
        render(
            <InviteDialog
                kind={KIND_INVITE}
                roomId={roomId}
                onFinished={jest.fn()}
                initialText="@localpart:server.tld"
            />,
        );

        await screen.findAllByText("@localpart:server.tld"); // Using findAllByText as the MXID is used for name too
    });

    it("should not suggest invalid MXIDs", () => {
        render(
            <InviteDialog
                kind={KIND_INVITE}
                roomId={roomId}
                onFinished={jest.fn()}
                initialText="@localpart:server:tld"
            />,
        );

        expect(screen.queryByText("@localpart:server:tld")).toBeFalsy();
    });

    it.each([[KIND_DM], [KIND_INVITE]] as [typeof KIND_DM | typeof KIND_INVITE][])(
        "should lookup inputs which look like email addresses (%s)",
        async (kind: typeof KIND_DM | typeof KIND_INVITE) => {
            mockClient.getIdentityServerUrl.mockReturnValue("https://identity-server");
            mockClient.lookupThreePid.mockResolvedValue({
                address: aliceEmail,
                medium: "email",
                mxid: aliceId,
            });
            mockClient.getProfileInfo.mockResolvedValue({
                displayname: "Mrs Alice",
                avatar_url: "mxc://foo/bar",
            });

            render(
                <InviteDialog
                    kind={kind}
                    roomId={kind === KIND_INVITE ? roomId : ""}
                    onFinished={jest.fn()}
                    initialText={aliceEmail}
                />,
            );

            await screen.findByText("Mrs Alice");
            // expect the email and MXID to be visible
            await screen.findByText(aliceId);
            await screen.findByText(aliceEmail);
            expect(mockClient.lookupThreePid).toHaveBeenCalledWith("email", aliceEmail, expect.anything());
            expect(mockClient.getProfileInfo).toHaveBeenCalledWith(aliceId);
        },
    );

    it("should suggest e-mail even if lookup fails", async () => {
        mockClient.getIdentityServerUrl.mockReturnValue("https://identity-server");
        mockClient.lookupThreePid.mockResolvedValue({});

        render(
            <InviteDialog kind={KIND_INVITE} roomId={roomId} onFinished={jest.fn()} initialText="foobar@email.com" />,
        );

        await screen.findByText("foobar@email.com");
        await screen.findByText("Invite by email");
    });
});
