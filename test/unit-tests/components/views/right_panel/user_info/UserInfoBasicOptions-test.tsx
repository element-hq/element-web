/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import userEvent from "@testing-library/user-event";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { type Mocked, mocked } from "jest-mock";
import { type MatrixClient, type Room, RoomMember, User } from "matrix-js-sdk/src/matrix";
import { render, screen } from "jest-matrix-react";

import { ShareDialog } from "../../../../../../src/components/views/dialogs/ShareDialog";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { Action } from "../../../../../../src/dispatcher/actions";
import Modal from "../../../../../../src/Modal";
import { startDmOnFirstMessage, DirectoryMember } from "../../../../../../src/utils/direct-messages";
import MultiInviter from "../../../../../../src/utils/MultiInviter";
import { clearAllModals, flushPromises } from "../../../../../test-utils";
import { UserOptionsSection } from "../../../../../../src/components/views/right_panel/user_info/UserInfoBasic";
import dis from "../../../../../../src/dispatcher/dispatcher";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";

jest.mock("../../../../../src/dispatcher/dispatcher");

const defaultRoomId = "!fkfk";
const defaultUserId = "@user:example.com";
const defaultUser = new User(defaultUserId);

let mockRoom: Mocked<Room>;
let mockClient: Mocked<MatrixClient>;
let mockCrypto: Mocked<CryptoApi>;

beforeEach(() => {
    mockRoom = mocked({
        roomId: defaultRoomId,
        getType: jest.fn().mockReturnValue(undefined),
        isSpaceRoom: jest.fn().mockReturnValue(false),
        getMember: jest.fn().mockReturnValue(undefined),
        getMxcAvatarUrl: jest.fn().mockReturnValue("mock-avatar-url"),
        name: "test room",
        on: jest.fn(),
        off: jest.fn(),
        currentState: {
            getStateEvents: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        },
        getEventReadUpTo: jest.fn(),
    } as unknown as Room);

    mockCrypto = mocked({
        getDeviceVerificationStatus: jest.fn(),
        getUserDeviceInfo: jest.fn(),
        userHasCrossSigningKeys: jest.fn().mockResolvedValue(false),
        getUserVerificationStatus: jest.fn(),
        isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(false),
    } as unknown as CryptoApi);

    mockClient = mocked({
        getUser: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        isUserIgnored: jest.fn(),
        getIgnoredUsers: jest.fn(),
        setIgnoredUsers: jest.fn(),
        getUserId: jest.fn(),
        getSafeUserId: jest.fn(),
        getDomain: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        isSynapseAdministrator: jest.fn().mockResolvedValue(false),
        doesServerSupportUnstableFeature: jest.fn().mockReturnValue(false),
        doesServerSupportExtendedProfiles: jest.fn().mockResolvedValue(false),
        getExtendedProfileProperty: jest.fn().mockRejectedValue(new Error("Not supported")),
        mxcUrlToHttp: jest.fn().mockReturnValue("mock-mxcUrlToHttp"),
        removeListener: jest.fn(),
        currentState: {
            on: jest.fn(),
        },
        getRoom: jest.fn(),
        credentials: {},
        setPowerLevel: jest.fn(),
        getCrypto: jest.fn().mockReturnValue(mockCrypto),
    } as unknown as MatrixClient);

    jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
    jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
});

describe("<UserOptionsSection />", () => {
    const member = new RoomMember(defaultRoomId, defaultUserId);
    const defaultProps = { member, canInvite: false, isSpace: false };
    const defaultVM = {};

    const renderComponent = (props = {}) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<UserOptionsSection vm={undefined} {...defaultProps} {...props} />, {
            wrapper: Wrapper,
        });
    };

    const inviteSpy = jest.spyOn(MultiInviter.prototype, "invite");

    beforeEach(() => {
        inviteSpy.mockReset();
        mockClient.setIgnoredUsers.mockClear();
    });

    afterEach(async () => {
        await clearAllModals();
    });

    afterAll(() => {
        inviteSpy.mockRestore();
    });

    it("always shows share user button and clicking it should produce a ShareDialog", async () => {
        const spy = jest.spyOn(Modal, "createDialog");

        renderComponent();
        await userEvent.click(screen.getByRole("button", { name: "Share profile" }));

        expect(spy).toHaveBeenCalledWith(ShareDialog, { target: defaultProps.member });
    });

    it("does not show ignore or direct message buttons when member userId matches client userId", () => {
        mockClient.getSafeUserId.mockReturnValueOnce(member.userId);
        mockClient.getUserId.mockReturnValueOnce(member.userId);
        renderComponent();

        expect(screen.queryByRole("button", { name: /ignore/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /message/i })).not.toBeInTheDocument();
    });

    it("shows direct message and mention buttons when member userId does not match client userId", () => {
        // call to client.getUserId returns undefined, which will not match member.userId
        renderComponent();

        expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Mention" })).toBeInTheDocument();
    });

    it("mention button fires ComposerInsert Action", async () => {
        renderComponent();

        const button = screen.getByRole("button", { name: "Mention" });
        await userEvent.click(button);
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: Action.ComposerInsert,
            timelineRenderingType: "Room",
            userId: "@user:example.com",
        });
    });

    it("when call to client.getRoom is null, shows disabled read receipt button", () => {
        mockClient.getRoom.mockReturnValueOnce(null);
        renderComponent();

        expect(screen.queryByRole("button", { name: "Jump to read receipt" })).toBeDisabled();
    });

    it("when call to client.getRoom is non-null and room.getEventReadUpTo is null, shows disabled read receipt button", () => {
        mockRoom.getEventReadUpTo.mockReturnValueOnce(null);
        mockClient.getRoom.mockReturnValueOnce(mockRoom);
        renderComponent();

        expect(screen.queryByRole("button", { name: "Jump to read receipt" })).toBeDisabled();
    });

    it("when calls to client.getRoom and room.getEventReadUpTo are non-null, shows read receipt button", () => {
        mockRoom.getEventReadUpTo.mockReturnValueOnce("1234");
        mockClient.getRoom.mockReturnValueOnce(mockRoom);
        renderComponent();

        expect(screen.getByRole("button", { name: "Jump to read receipt" })).toBeInTheDocument();
    });

    it("clicking the read receipt button calls dispatch with correct event_id", async () => {
        const mockEventId = "1234";
        mockRoom.getEventReadUpTo.mockReturnValue(mockEventId);
        mockClient.getRoom.mockReturnValue(mockRoom);
        renderComponent();

        const readReceiptButton = screen.getByRole("button", { name: "Jump to read receipt" });

        expect(readReceiptButton).toBeInTheDocument();
        await userEvent.click(readReceiptButton);
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: "view_room",
            event_id: mockEventId,
            highlighted: true,
            metricsTrigger: undefined,
            room_id: "!fkfk",
        });

        mockRoom.getEventReadUpTo.mockReset();
        mockClient.getRoom.mockReset();
    });

    it("firing the read receipt event handler with a null event_id calls dispatch with undefined not null", async () => {
        const mockEventId = "1234";
        // the first call is the check to see if we should render the button, second call is
        // when the button is clicked
        mockRoom.getEventReadUpTo.mockReturnValueOnce(mockEventId).mockReturnValueOnce(null);
        mockClient.getRoom.mockReturnValue(mockRoom);
        renderComponent();

        const readReceiptButton = screen.getByRole("button", { name: "Jump to read receipt" });

        expect(readReceiptButton).toBeInTheDocument();
        await userEvent.click(readReceiptButton);
        expect(dis.dispatch).toHaveBeenCalledWith({
            action: "view_room",
            event_id: undefined,
            highlighted: true,
            metricsTrigger: undefined,
            room_id: "!fkfk",
        });

        mockClient.getRoom.mockReset();
    });

    it("does not show the invite button when canInvite is false", () => {
        renderComponent();
        expect(screen.queryByRole("button", { name: /invite/i })).not.toBeInTheDocument();
    });

    it("shows the invite button when canInvite is true", () => {
        renderComponent({ canInvite: true });
        expect(screen.getByRole("button", { name: /invite/i })).toBeInTheDocument();
    });

    it("clicking the invite button will call MultiInviter.invite", async () => {
        // to save mocking, we will reject the call to .invite
        const mockErrorMessage = new Error("test error message");
        inviteSpy.mockRejectedValue(mockErrorMessage);

        // render the component and click the button
        renderComponent({ canInvite: true });
        const inviteButton = screen.getByRole("button", { name: /invite/i });
        expect(inviteButton).toBeInTheDocument();
        await userEvent.click(inviteButton);

        // check that we have called .invite
        expect(inviteSpy).toHaveBeenCalledWith([member.userId]);

        // check that the test error message is displayed
        await expect(screen.findByText(mockErrorMessage.message)).resolves.toBeInTheDocument();
    });

    it("if calling .invite throws something strange, show default error message", async () => {
        inviteSpy.mockRejectedValue({ this: "could be anything" });

        // render the component and click the button
        renderComponent({ canInvite: true });
        const inviteButton = screen.getByRole("button", { name: /invite/i });
        expect(inviteButton).toBeInTheDocument();
        await userEvent.click(inviteButton);

        // check that the default test error message is displayed
        await expect(screen.findByText(/operation failed/i)).resolves.toBeInTheDocument();
    });

    it.each([
        ["for a RoomMember", member, member.getMxcAvatarUrl()],
        ["for a User", defaultUser, defaultUser.avatarUrl],
    ])(
        "clicking »message« %s should start a DM",
        async (test: string, member: RoomMember | User, expectedAvatarUrl: string | undefined) => {
            const deferred = Promise.withResolvers<string>();
            mocked(startDmOnFirstMessage).mockReturnValue(deferred.promise);

            renderComponent({ member });
            await userEvent.click(screen.getByRole("button", { name: "Send message" }));

            // Checking the attribute, because the button is a DIV and toBeDisabled() does not work.
            expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

            expect(startDmOnFirstMessage).toHaveBeenCalledWith(mockClient, [
                new DirectoryMember({
                    user_id: member.userId,
                    display_name: member.rawDisplayName,
                    avatar_url: expectedAvatarUrl,
                }),
            ]);

            await act(async () => {
                deferred.resolve("!dm:example.com");
                await flushPromises();
            });

            // Checking the attribute, because the button is a DIV and toBeDisabled() does not work.
            expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();
        },
    );
});
