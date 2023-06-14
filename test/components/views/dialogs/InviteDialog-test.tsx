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
import userEvent from "@testing-library/user-event";
import { RoomType } from "matrix-js-sdk/src/@types/event";
import { MatrixClient, MatrixError, Room } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { mocked, Mocked } from "jest-mock";

import InviteDialog from "../../../../src/components/views/dialogs/InviteDialog";
import { InviteKind } from "../../../../src/components/views/dialogs/InviteDialogTypes";
import {
    filterConsole,
    getMockClientWithEventEmitter,
    mkMembership,
    mkMessage,
    mkRoomCreateEvent,
} from "../../../test-utils";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import SdkConfig from "../../../../src/SdkConfig";
import { ValidatedServerConfig } from "../../../../src/utils/ValidatedServerConfig";
import { IConfigOptions } from "../../../../src/IConfigOptions";
import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import { IProfileInfo } from "../../../../src/hooks/useProfileInfo";
import { DirectoryMember, startDmOnFirstMessage } from "../../../../src/utils/direct-messages";
import SettingsStore from "../../../../src/settings/SettingsStore";
import Modal from "../../../../src/Modal";

const mockGetAccessToken = jest.fn().mockResolvedValue("getAccessToken");
jest.mock("../../../../src/IdentityAuthClient", () =>
    jest.fn().mockImplementation(() => ({
        getAccessToken: mockGetAccessToken,
    })),
);

jest.mock("../../../../src/utils/direct-messages", () => ({
    ...jest.requireActual("../../../../src/utils/direct-messages"),
    __esModule: true,
    startDmOnFirstMessage: jest.fn(),
}));

const getSearchField = () => screen.getByTestId("invite-dialog-input");

const enterIntoSearchField = async (value: string) => {
    const searchField = getSearchField();
    await userEvent.clear(searchField);
    await userEvent.type(searchField, value + "{enter}");
};

const pasteIntoSearchField = async (value: string) => {
    const searchField = getSearchField();
    await userEvent.clear(searchField);
    searchField.focus();
    await userEvent.paste(value);
};

const expectPill = (value: string) => {
    expect(screen.getByText(value)).toBeInTheDocument();
    expect(getSearchField()).toHaveValue("");
};

const expectNoPill = (value: string) => {
    expect(screen.queryByText(value)).not.toBeInTheDocument();
    expect(getSearchField()).toHaveValue(value);
};

const roomId = "!111111111111111111:example.org";
const aliceId = "@alice:example.org";
const aliceEmail = "foobar@email.com";
const bobId = "@bob:example.org";
const bobEmail = "bobbob@example.com"; // bob@example.com is already used as an example in the invite dialog
const carolId = "@carol:example.com";

const aliceProfileInfo: IProfileInfo = {
    user_id: aliceId,
    display_name: "Alice",
};

const bobProfileInfo: IProfileInfo = {
    user_id: bobId,
    display_name: "Bob",
};

describe("InviteDialog", () => {
    let mockClient: Mocked<MatrixClient>;
    let room: Room;

    filterConsole(
        "Error retrieving profile for userId @carol:example.com",
        "Error retrieving profile for userId @localpart:server.tld",
        "Error retrieving profile for userId @localpart:server:tld",
        "[Invite:Recents] Excluding @alice:example.org from recents",
    );

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
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
            getProfileInfo: jest.fn().mockImplementation(async (userId: string) => {
                if (userId === aliceId) return aliceProfileInfo;
                if (userId === bobId) return bobProfileInfo;

                throw new MatrixError({
                    errcode: "M_NOT_FOUND",
                    error: "Profile not found",
                });
            }),
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
            getClientWellKnown: jest.fn().mockResolvedValue({}),
        });
        SdkConfig.put({ validated_server_config: {} as ValidatedServerConfig } as IConfigOptions);
        DMRoomMap.makeShared(mockClient);
        jest.clearAllMocks();

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

        SdkContextClass.instance.client = mockClient;
    });

    afterEach(() => {
        Modal.closeCurrentModal();
        SdkContextClass.instance.onLoggedOut();
        SdkContextClass.instance.client = undefined;
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("should label with space name", () => {
        room.isSpaceRoom = jest.fn().mockReturnValue(true);
        room.getType = jest.fn().mockReturnValue(RoomType.Space);
        room.name = "Space";
        render(<InviteDialog kind={InviteKind.Invite} roomId={roomId} onFinished={jest.fn()} />);

        expect(screen.queryByText("Invite to Space")).toBeTruthy();
    });

    it("should label with room name", () => {
        render(<InviteDialog kind={InviteKind.Invite} roomId={roomId} onFinished={jest.fn()} />);
        expect(screen.getByText(`Invite to ${roomId}`)).toBeInTheDocument();
    });

    it("should suggest valid MXIDs even if unknown", async () => {
        render(
            <InviteDialog
                kind={InviteKind.Invite}
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
                kind={InviteKind.Invite}
                roomId={roomId}
                onFinished={jest.fn()}
                initialText="@localpart:server:tld"
            />,
        );

        expect(screen.queryByText("@localpart:server:tld")).toBeFalsy();
    });

    it.each([[InviteKind.Dm], [InviteKind.Invite]] as [typeof InviteKind.Dm | typeof InviteKind.Invite][])(
        "should lookup inputs which look like email addresses (%s)",
        async (kind: typeof InviteKind.Dm | typeof InviteKind.Invite) => {
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
                    roomId={kind === InviteKind.Invite ? roomId : ""}
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
            <InviteDialog
                kind={InviteKind.Invite}
                roomId={roomId}
                onFinished={jest.fn()}
                initialText="foobar@email.com"
            />,
        );

        await screen.findByText("foobar@email.com");
        await screen.findByText("Invite by email");
    });

    it("should add pasted values", async () => {
        mockClient.getIdentityServerUrl.mockReturnValue("https://identity-server");
        mockClient.lookupThreePid.mockResolvedValue({});

        render(<InviteDialog kind={InviteKind.Invite} roomId={roomId} onFinished={jest.fn()} />);

        const input = screen.getByTestId("invite-dialog-input");
        input.focus();
        await userEvent.paste(`${bobId} ${aliceEmail}`);

        await screen.findAllByText(bobId);
        await screen.findByText(aliceEmail);
        expect(input).toHaveValue("");
    });

    it("should allow to invite multiple emails to a room", async () => {
        render(<InviteDialog kind={InviteKind.Invite} roomId={roomId} onFinished={jest.fn()} />);

        await enterIntoSearchField(aliceEmail);
        expectPill(aliceEmail);

        await enterIntoSearchField(bobEmail);
        expectPill(bobEmail);
    });

    describe("when encryption by default is disabled", () => {
        beforeEach(() => {
            mockClient.getClientWellKnown.mockReturnValue({
                "io.element.e2ee": {
                    default: false,
                },
            });
        });

        it("should allow to invite more than one email to a DM", async () => {
            render(<InviteDialog kind={InviteKind.Dm} onFinished={jest.fn()} />);

            await enterIntoSearchField(aliceEmail);
            expectPill(aliceEmail);

            await enterIntoSearchField(bobEmail);
            expectPill(bobEmail);
        });
    });

    it("should not allow to invite more than one email to a DM", async () => {
        render(<InviteDialog kind={InviteKind.Dm} onFinished={jest.fn()} />);

        // Start with an email → should convert to a pill
        await enterIntoSearchField(aliceEmail);
        expect(screen.getByText("Invites by email can only be sent one at a time")).toBeInTheDocument();
        expectPill(aliceEmail);

        // Everything else from now on should not convert to a pill

        await enterIntoSearchField(bobEmail);
        expectNoPill(bobEmail);

        await enterIntoSearchField(aliceId);
        expectNoPill(aliceId);

        await pasteIntoSearchField(bobEmail);
        expectNoPill(bobEmail);
    });

    it("should not allow to invite a MXID and an email to a DM", async () => {
        render(<InviteDialog kind={InviteKind.Dm} onFinished={jest.fn()} />);

        // Start with a MXID → should convert to a pill
        await enterIntoSearchField(carolId);
        expect(screen.queryByText("Invites by email can only be sent one at a time")).not.toBeInTheDocument();
        expectPill(carolId);

        // Add an email → should not convert to a pill
        await enterIntoSearchField(bobEmail);
        expect(screen.getByText("Invites by email can only be sent one at a time")).toBeInTheDocument();
        expectNoPill(bobEmail);
    });

    it("should start a DM if the profile is available", async () => {
        render(<InviteDialog kind={InviteKind.Dm} onFinished={jest.fn()} />);
        await enterIntoSearchField(aliceId);
        await userEvent.click(screen.getByRole("button", { name: "Go" }));
        expect(startDmOnFirstMessage).toHaveBeenCalledWith(mockClient, [
            new DirectoryMember({
                user_id: aliceId,
            }),
        ]);
    });

    describe("when inviting a user with an unknown profile", () => {
        beforeEach(async () => {
            render(<InviteDialog kind={InviteKind.Dm} onFinished={jest.fn()} />);
            await enterIntoSearchField(carolId);
            await userEvent.click(screen.getByRole("button", { name: "Go" }));
            // Wait for the »invite anyway« modal to show up
            await screen.findByText("The following users may not exist");
        });

        it("should not start the DM", () => {
            expect(startDmOnFirstMessage).not.toHaveBeenCalled();
        });

        it("should show the »invite anyway« dialog if the profile is not available", () => {
            expect(screen.getByText("The following users may not exist")).toBeInTheDocument();
            expect(screen.getByText(`${carolId}: Profile not found`)).toBeInTheDocument();
        });

        describe("when clicking »Start DM anyway«", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByRole("button", { name: "Start DM anyway", exact: true }));
            });

            it("should start the DM", () => {
                expect(startDmOnFirstMessage).toHaveBeenCalledWith(mockClient, [
                    new DirectoryMember({
                        user_id: carolId,
                    }),
                ]);
            });
        });

        describe("when clicking »Close«", () => {
            beforeEach(async () => {
                mocked(startDmOnFirstMessage).mockClear();
                await userEvent.click(screen.getByRole("button", { name: "Close" }));
            });

            it("should not start the DM", () => {
                expect(startDmOnFirstMessage).not.toHaveBeenCalled();
            });
        });
    });

    describe("when inviting a user with an unknown profile and »promptBeforeInviteUnknownUsers« setting = false", () => {
        beforeEach(async () => {
            mocked(startDmOnFirstMessage).mockClear();
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName !== "promptBeforeInviteUnknownUsers",
            );
            render(<InviteDialog kind={InviteKind.Dm} onFinished={jest.fn()} />);
            await enterIntoSearchField(carolId);
            await userEvent.click(screen.getByRole("button", { name: "Go" }));
            // modal rendering has some weird sleeps - fake timers will mess up the entire test
            await sleep(100);
        });

        it("should not show the »invite anyway« dialog", () => {
            expect(screen.queryByText("The following users may not exist")).not.toBeInTheDocument();
        });

        it("should start the DM directly", () => {
            expect(startDmOnFirstMessage).toHaveBeenCalledWith(mockClient, [
                new DirectoryMember({
                    user_id: carolId,
                }),
            ]);
        });
    });
});
