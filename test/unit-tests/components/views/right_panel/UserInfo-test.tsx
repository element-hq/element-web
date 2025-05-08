/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen, cleanup, act, waitForElementToBeRemoved, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type Mocked, mocked } from "jest-mock";
import {
    type Room,
    User,
    type MatrixClient,
    RoomMember,
    MatrixEvent,
    EventType,
    Device,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { defer } from "matrix-js-sdk/src/utils";
import { EventEmitter } from "events";
import {
    UserVerificationStatus,
    type VerificationRequest,
    VerificationPhase as Phase,
    VerificationRequestEvent,
    type CryptoApi,
} from "matrix-js-sdk/src/crypto-api";

import UserInfo, {
    BanToggleButton,
    disambiguateDevices,
    getPowerLevels,
    isMuted,
    PowerLevelEditor,
    RoomAdminToolsContainer,
    RoomKickButton,
    UserInfoHeader,
    UserOptionsSection,
} from "../../../../../src/components/views/right_panel/UserInfo";
import dis from "../../../../../src/dispatcher/dispatcher";
import { RightPanelPhases } from "../../../../../src/stores/right-panel/RightPanelStorePhases";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import MultiInviter from "../../../../../src/utils/MultiInviter";
import Modal from "../../../../../src/Modal";
import { DirectoryMember, startDmOnFirstMessage } from "../../../../../src/utils/direct-messages";
import { clearAllModals, flushPromises } from "../../../../test-utils";
import ErrorDialog from "../../../../../src/components/views/dialogs/ErrorDialog";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../../src/settings/UIFeature";
import { Action } from "../../../../../src/dispatcher/actions";
import { ShareDialog } from "../../../../../src/components/views/dialogs/ShareDialog";
import BulkRedactDialog from "../../../../../src/components/views/dialogs/BulkRedactDialog";

jest.mock("../../../../../src/utils/direct-messages", () => ({
    ...jest.requireActual("../../../../../src/utils/direct-messages"),
    startDmOnFirstMessage: jest.fn(),
}));

jest.mock("../../../../../src/dispatcher/dispatcher");

jest.mock("../../../../../src/customisations/UserIdentifier", () => {
    return {
        getDisplayUserIdentifier: jest.fn().mockReturnValue("customUserIdentifier"),
    };
});

jest.mock("../../../../../src/utils/DMRoomMap", () => {
    const mock = {
        getUserIdForRoomId: jest.fn(),
        getDMRoomsForUserId: jest.fn(),
    };

    return {
        shared: jest.fn().mockReturnValue(mock),
        sharedInstance: mock,
    };
});

jest.mock("../../../../../src/customisations/helpers/UIComponents", () => {
    const original = jest.requireActual("../../../../../src/customisations/helpers/UIComponents");
    return {
        shouldShowComponent: jest.fn().mockImplementation(original.shouldShowComponent),
    };
});

const defaultRoomId = "!fkfk";
const defaultUserId = "@user:example.com";
const defaultUser = new User(defaultUserId);

let mockRoom: Mocked<Room>;
let mockSpace: Mocked<Room>;
let mockClient: Mocked<MatrixClient>;
let mockCrypto: Mocked<CryptoApi>;
const origDate = global.Date.prototype.toLocaleString;

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

    mockSpace = mocked({
        roomId: defaultRoomId,
        getType: jest.fn().mockReturnValue("m.space"),
        isSpaceRoom: jest.fn().mockReturnValue(true),
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

describe("<UserInfo />", () => {
    class MockVerificationRequest extends EventEmitter {
        pending = true;
        phase: Phase = Phase.Ready;
        cancellationCode: string | null = null;

        constructor(opts: Partial<VerificationRequest>) {
            super();
            Object.assign(this, {
                channel: { transactionId: 1 },
                otherPartySupportsMethod: jest.fn(),
                generateQRCode: jest.fn().mockReturnValue(new Promise(() => {})),
                ...opts,
            });
        }
    }
    let verificationRequest: MockVerificationRequest;

    const defaultProps = {
        user: defaultUser,
        // idk what is wrong with this type
        phase: RightPanelPhases.MemberInfo as RightPanelPhases.MemberInfo,
        onClose: jest.fn(),
    };

    const renderComponent = (props = {}) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<UserInfo {...defaultProps} {...props} />, {
            wrapper: Wrapper,
        });
    };

    beforeEach(() => {
        verificationRequest = new MockVerificationRequest({});
    });

    afterEach(async () => {
        await clearAllModals();
        jest.clearAllMocks();
    });

    it("closes on close button click", async () => {
        renderComponent();

        await userEvent.click(screen.getByTestId("base-card-close-button"));

        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    describe("without a room", () => {
        it("does not render space header", () => {
            renderComponent();
            expect(screen.queryByTestId("space-header")).not.toBeInTheDocument();
        });

        it("renders user info", () => {
            renderComponent();
            expect(screen.getByRole("heading", { name: defaultUserId })).toBeInTheDocument();
        });

        it("renders user timezone if set", async () => {
            // For timezone, force a consistent locale.
            jest.spyOn(global.Date.prototype, "toLocaleString").mockImplementation(function (
                this: Date,
                _locale,
                opts,
            ) {
                return origDate.call(this, "en-US", {
                    ...opts,
                    hourCycle: "h12",
                });
            });
            mockClient.doesServerSupportExtendedProfiles.mockResolvedValue(true);
            mockClient.getExtendedProfileProperty.mockResolvedValue("Europe/London");
            renderComponent();
            await expect(screen.findByText(/\d\d:\d\d (AM|PM)/)).resolves.toBeInTheDocument();
        });

        it("does not renders user timezone if timezone is invalid", async () => {
            mockClient.doesServerSupportExtendedProfiles.mockResolvedValue(true);
            mockClient.getExtendedProfileProperty.mockResolvedValue("invalid-tz");
            renderComponent();
            expect(screen.queryByText(/\d\d:\d\d (AM|PM)/)).not.toBeInTheDocument();
        });

        it("renders encryption info panel without pending verification", () => {
            renderComponent({ phase: RightPanelPhases.EncryptionPanel });
            expect(screen.getByRole("heading", { name: /encryption/i })).toBeInTheDocument();
        });

        it("renders encryption verification panel with pending verification", () => {
            renderComponent({ phase: RightPanelPhases.EncryptionPanel, verificationRequest });

            expect(screen.queryByRole("heading", { name: /encryption/i })).not.toBeInTheDocument();
            // the verificationRequest has phase of Phase.Ready but .otherPartySupportsMethod
            // will not return true, so we expect to see the noCommonMethod error from VerificationPanel
            expect(screen.getByText(/try with a different client/i)).toBeInTheDocument();
        });

        it("should show error modal when the verification request is cancelled with a mismatch", () => {
            renderComponent({ phase: RightPanelPhases.EncryptionPanel, verificationRequest });

            const spy = jest.spyOn(Modal, "createDialog");
            act(() => {
                verificationRequest.phase = Phase.Cancelled;
                verificationRequest.cancellationCode = "m.key_mismatch";
                verificationRequest.emit(VerificationRequestEvent.Change);
            });
            expect(spy).toHaveBeenCalledWith(
                ErrorDialog,
                expect.objectContaining({ title: "Your messages are not secure" }),
            );
        });

        it("should not show error modal when the verification request is changed for some other reason", () => {
            renderComponent({ phase: RightPanelPhases.EncryptionPanel, verificationRequest });

            const spy = jest.spyOn(Modal, "createDialog");

            // change to "started"
            act(() => {
                verificationRequest.phase = Phase.Started;
                verificationRequest.emit(VerificationRequestEvent.Change);
            });

            // cancelled for some other reason
            act(() => {
                verificationRequest.phase = Phase.Cancelled;
                verificationRequest.cancellationCode = "changed my mind";
                verificationRequest.emit(VerificationRequestEvent.Change);
            });

            expect(spy).not.toHaveBeenCalled();
        });

        it("renders close button correctly when encryption panel with a pending verification request", async () => {
            renderComponent({ phase: RightPanelPhases.EncryptionPanel, verificationRequest });
            screen.getByTestId("base-card-close-button").focus();
            expect(screen.getByText("Cancel")).toBeInTheDocument();
        });
    });

    describe("with a room", () => {
        it("renders user info", () => {
            renderComponent({ room: mockRoom });
            expect(screen.getByRole("heading", { name: defaultUserId })).toBeInTheDocument();
        });

        it("does not render space header when room is not a space room", () => {
            renderComponent({ room: mockRoom });
            expect(screen.queryByTestId("space-header")).not.toBeInTheDocument();
        });

        it("renders encryption info panel without pending verification", () => {
            renderComponent({ phase: RightPanelPhases.EncryptionPanel, room: mockRoom });
            expect(screen.getByRole("heading", { name: /encryption/i })).toBeInTheDocument();
        });

        it("renders encryption verification panel with pending verification", () => {
            renderComponent({ phase: RightPanelPhases.EncryptionPanel, verificationRequest, room: mockRoom });

            expect(screen.queryByRole("heading", { name: /encryption/i })).not.toBeInTheDocument();
            // the verificationRequest has phase of Phase.Ready but .otherPartySupportsMethod
            // will not return true, so we expect to see the noCommonMethod error from VerificationPanel
            expect(screen.getByText(/try with a different client/i)).toBeInTheDocument();
        });

        it("renders the message button", () => {
            render(
                <MatrixClientContext.Provider value={mockClient}>
                    <UserInfo {...defaultProps} />
                </MatrixClientContext.Provider>,
            );

            screen.getByRole("button", { name: "Send message" });
        });

        it("hides the message button if the visibility customisation hides all create room features", () => {
            mocked(shouldShowComponent).withImplementation(
                (component) => {
                    return component !== UIComponent.CreateRooms;
                },
                () => {
                    render(
                        <MatrixClientContext.Provider value={mockClient}>
                            <UserInfo {...defaultProps} />
                        </MatrixClientContext.Provider>,
                    );

                    expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
                },
            );
        });

        describe("Ignore", () => {
            const member = new RoomMember(defaultRoomId, defaultUserId);

            it("shows block button when member userId does not match client userId", () => {
                // call to client.getUserId returns undefined, which will not match member.userId
                renderComponent();

                expect(screen.getByRole("button", { name: "Ignore" })).toBeInTheDocument();
            });

            it("shows a modal before ignoring the user", async () => {
                const originalCreateDialog = Modal.createDialog;
                const modalSpy = (Modal.createDialog = jest.fn().mockReturnValue({
                    finished: Promise.resolve([true]),
                    close: () => {},
                }));

                try {
                    mockClient.getIgnoredUsers.mockReturnValue([]);
                    renderComponent();

                    await userEvent.click(screen.getByRole("button", { name: "Ignore" }));
                    expect(modalSpy).toHaveBeenCalled();
                    expect(mockClient.setIgnoredUsers).toHaveBeenLastCalledWith([member.userId]);
                } finally {
                    Modal.createDialog = originalCreateDialog;
                }
            });

            it("cancels ignoring the user", async () => {
                const originalCreateDialog = Modal.createDialog;
                const modalSpy = (Modal.createDialog = jest.fn().mockReturnValue({
                    finished: Promise.resolve([false]),
                    close: () => {},
                }));

                try {
                    mockClient.getIgnoredUsers.mockReturnValue([]);
                    renderComponent();

                    await userEvent.click(screen.getByRole("button", { name: "Ignore" }));
                    expect(modalSpy).toHaveBeenCalled();
                    expect(mockClient.setIgnoredUsers).not.toHaveBeenCalled();
                } finally {
                    Modal.createDialog = originalCreateDialog;
                }
            });

            it("unignores the user", async () => {
                mockClient.isUserIgnored.mockReturnValue(true);
                mockClient.getIgnoredUsers.mockReturnValue([member.userId]);
                renderComponent();

                await userEvent.click(screen.getByRole("button", { name: "Unignore" }));
                expect(mockClient.setIgnoredUsers).toHaveBeenCalledWith([]);
            });
        });
    });

    describe("with crypto enabled", () => {
        beforeEach(() => {
            mockClient.doesServerSupportUnstableFeature.mockResolvedValue(true);
            mockCrypto.getUserVerificationStatus.mockResolvedValue(new UserVerificationStatus(false, false, false));

            const device = new Device({
                deviceId: "d1",
                userId: defaultUserId,
                displayName: "my device",
                algorithms: [],
                keys: new Map(),
            });
            const devicesMap = new Map<string, Device>([[device.deviceId, device]]);
            const userDeviceMap = new Map<string, Map<string, Device>>([[defaultUserId, devicesMap]]);
            mockCrypto.getUserDeviceInfo.mockResolvedValue(userDeviceMap);
        });

        it("renders <BasicUserInfo />", async () => {
            mockCrypto.getUserVerificationStatus.mockResolvedValue(new UserVerificationStatus(false, false, false));

            const { container } = renderComponent({
                phase: RightPanelPhases.MemberInfo,
                verificationRequest,
                room: mockRoom,
            });
            await flushPromises();
            expect(container).toMatchSnapshot();
        });

        it("should render a deactivate button for users of the same server if we are a server admin", async () => {
            mockClient.isSynapseAdministrator.mockResolvedValue(true);
            mockClient.getDomain.mockReturnValue("example.com");

            const { container } = renderComponent({
                phase: RightPanelPhases.MemberInfo,
                room: mockRoom,
            });

            await expect(screen.findByRole("button", { name: "Deactivate user" })).resolves.toBeInTheDocument();
            if (screen.queryAllByRole("progressbar").length) {
                await act(() => waitForElementToBeRemoved(() => screen.queryAllByRole("progressbar")));
            }
            expect(container).toMatchSnapshot();
        });
    });
});

describe("<UserInfoHeader />", () => {
    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    const defaultProps = {
        member: defaultMember,
        roomId: defaultRoomId,
    };

    const renderComponent = (props = {}) => {
        const device1 = new Device({
            deviceId: "d1",
            userId: defaultUserId,
            displayName: "my device",
            algorithms: [],
            keys: new Map(),
        });
        const devicesMap = new Map<string, Device>([[device1.deviceId, device1]]);
        const userDeviceMap = new Map<string, Map<string, Device>>([[defaultUserId, devicesMap]]);
        mockCrypto.getUserDeviceInfo.mockResolvedValue(userDeviceMap);
        mockClient.doesServerSupportUnstableFeature.mockResolvedValue(true);
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<UserInfoHeader {...defaultProps} {...props} devices={[device1]} />, {
            wrapper: Wrapper,
        });
    };

    it("renders custom user identifiers in the header", () => {
        renderComponent();
        expect(screen.getByText("customUserIdentifier")).toBeInTheDocument();
    });

    it("renders verified badge when user is verified", async () => {
        mockCrypto.getUserVerificationStatus.mockResolvedValue(new UserVerificationStatus(true, true, false));
        const { container } = renderComponent();
        await waitFor(() => expect(screen.getByText("Verified")).toBeInTheDocument());
        expect(container).toMatchSnapshot();
    });

    it("renders verify button", async () => {
        mockCrypto.getUserVerificationStatus.mockResolvedValue(new UserVerificationStatus(false, false, false));
        mockCrypto.userHasCrossSigningKeys.mockResolvedValue(true);
        const { container } = renderComponent();
        await waitFor(() => expect(screen.getByText("Verify User")).toBeInTheDocument());
        expect(container).toMatchSnapshot();
    });

    it("renders verification unavailable message", async () => {
        mockCrypto.getUserVerificationStatus.mockResolvedValue(new UserVerificationStatus(false, false, false));
        mockCrypto.userHasCrossSigningKeys.mockResolvedValue(false);
        const { container } = renderComponent();
        await waitFor(() => expect(screen.getByText("(User verification unavailable)")).toBeInTheDocument());
        expect(container).toMatchSnapshot();
    });
});

describe("<UserOptionsSection />", () => {
    const member = new RoomMember(defaultRoomId, defaultUserId);
    const defaultProps = { member, canInvite: false, isSpace: false };

    const renderComponent = (props = {}) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<UserOptionsSection {...defaultProps} {...props} />, {
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
            const deferred = defer<string>();
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

describe("<PowerLevelEditor />", () => {
    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    let defaultProps: Parameters<typeof PowerLevelEditor>[0];
    beforeEach(() => {
        defaultProps = {
            user: defaultMember,
            room: mockRoom,
            roomPermissions: {
                modifyLevelMax: 100,
                canEdit: false,
                canInvite: false,
            },
        };
    });

    const renderComponent = (props = {}) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<PowerLevelEditor {...defaultProps} {...props} />, {
            wrapper: Wrapper,
        });
    };

    it("renders a power level combobox", () => {
        renderComponent();

        expect(screen.getByRole("combobox", { name: "Power level" })).toBeInTheDocument();
    });

    it("renders a combobox and attempts to change power level on change of the combobox", async () => {
        const startPowerLevel = 999;
        const powerLevelEvent = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: { users: { [defaultUserId]: startPowerLevel }, users_default: 1 },
        });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);
        mockClient.getSafeUserId.mockReturnValueOnce(defaultUserId);
        mockClient.getUserId.mockReturnValueOnce(defaultUserId);
        mockClient.setPowerLevel.mockResolvedValueOnce({ event_id: "123" });
        renderComponent();

        const changedPowerLevel = 100;

        fireEvent.change(screen.getByRole("combobox", { name: "Power level" }), {
            target: { value: changedPowerLevel },
        });

        await screen.findByText("Demote", { exact: true });

        // firing the event will raise a dialog warning about self demotion, wait for this to appear then click on it
        await userEvent.click(await screen.findByText("Demote", { exact: true }));
        expect(mockClient.setPowerLevel).toHaveBeenCalledTimes(1);
        expect(mockClient.setPowerLevel).toHaveBeenCalledWith(mockRoom.roomId, defaultMember.userId, changedPowerLevel);
    });
});

describe("<RoomKickButton />", () => {
    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    const memberWithInviteMembership = { ...defaultMember, membership: KnownMembership.Invite };
    const memberWithJoinMembership = { ...defaultMember, membership: KnownMembership.Join };

    let defaultProps: Parameters<typeof RoomKickButton>[0];
    beforeEach(() => {
        defaultProps = {
            room: mockRoom,
            member: defaultMember,
            startUpdating: jest.fn(),
            stopUpdating: jest.fn(),
            isUpdating: false,
        };
    });

    const renderComponent = (props = {}) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<RoomKickButton {...defaultProps} {...props} />, {
            wrapper: Wrapper,
        });
    };

    const createDialogSpy: jest.SpyInstance = jest.spyOn(Modal, "createDialog");

    afterEach(() => {
        createDialogSpy.mockReset();
    });

    it("renders nothing if member.membership is undefined", () => {
        // .membership is undefined in our member by default
        const { container } = renderComponent();
        expect(container).toBeEmptyDOMElement();
    });

    it("renders something if member.membership is 'invite' or 'join'", () => {
        let result = renderComponent({ member: memberWithInviteMembership });
        expect(result.container).not.toBeEmptyDOMElement();

        cleanup();

        result = renderComponent({ member: memberWithJoinMembership });
        expect(result.container).not.toBeEmptyDOMElement();
    });

    it("renders the correct label", () => {
        // test for room
        renderComponent({ member: memberWithJoinMembership });
        expect(screen.getByText(/remove from room/i)).toBeInTheDocument();
        cleanup();

        renderComponent({ member: memberWithInviteMembership });
        expect(screen.getByText(/disinvite from room/i)).toBeInTheDocument();
        cleanup();

        // test for space
        mockRoom.isSpaceRoom.mockReturnValue(true);
        renderComponent({ member: memberWithJoinMembership });
        expect(screen.getByText(/remove from space/i)).toBeInTheDocument();
        cleanup();

        renderComponent({ member: memberWithInviteMembership });
        expect(screen.getByText(/disinvite from space/i)).toBeInTheDocument();
        cleanup();
        mockRoom.isSpaceRoom.mockReturnValue(false);
    });

    it("clicking the kick button calls Modal.createDialog with the correct arguments", async () => {
        createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: jest.fn() });

        renderComponent({ room: mockSpace, member: memberWithInviteMembership });
        await userEvent.click(screen.getByText(/disinvite from/i));

        // check the last call arguments and the presence of the spaceChildFilter callback
        expect(createDialogSpy).toHaveBeenLastCalledWith(
            expect.any(Function),
            expect.objectContaining({ spaceChildFilter: expect.any(Function) }),
            "mx_ConfirmSpaceUserActionDialog_wrapper",
        );

        // test the spaceChildFilter callback
        const callback = createDialogSpy.mock.lastCall[1].spaceChildFilter;

        // make dummy values for myMember and theirMember, then we will test
        // null vs their member followed by
        // my member vs their member
        const mockMyMember = { powerLevel: 1 };
        const mockTheirMember = { membership: KnownMembership.Invite, powerLevel: 0 };

        const mockRoom = {
            getMember: jest
                .fn()
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(mockTheirMember)
                .mockReturnValueOnce(mockMyMember)
                .mockReturnValueOnce(mockTheirMember),
            currentState: {
                hasSufficientPowerLevelFor: jest.fn().mockReturnValue(true),
            },
        };

        expect(callback(mockRoom)).toBe(false);
        expect(callback(mockRoom)).toBe(true);
    });
});

describe("<BanToggleButton />", () => {
    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    const memberWithBanMembership = { ...defaultMember, membership: KnownMembership.Ban };
    let defaultProps: Parameters<typeof BanToggleButton>[0];
    beforeEach(() => {
        defaultProps = {
            room: mockRoom,
            member: defaultMember,
            startUpdating: jest.fn(),
            stopUpdating: jest.fn(),
            isUpdating: false,
        };
    });

    const renderComponent = (props = {}) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<BanToggleButton {...defaultProps} {...props} />, {
            wrapper: Wrapper,
        });
    };

    const createDialogSpy: jest.SpyInstance = jest.spyOn(Modal, "createDialog");

    afterEach(() => {
        createDialogSpy.mockReset();
    });

    it("renders the correct labels for banned and unbanned members", () => {
        // test for room
        // defaultMember is not banned
        renderComponent();
        expect(screen.getByText("Ban from room")).toBeInTheDocument();
        cleanup();

        renderComponent({ member: memberWithBanMembership });
        expect(screen.getByText("Unban from room")).toBeInTheDocument();
        cleanup();

        // test for space
        mockRoom.isSpaceRoom.mockReturnValue(true);
        renderComponent();
        expect(screen.getByText("Ban from space")).toBeInTheDocument();
        cleanup();

        renderComponent({ member: memberWithBanMembership });
        expect(screen.getByText("Unban from space")).toBeInTheDocument();
        cleanup();
        mockRoom.isSpaceRoom.mockReturnValue(false);
    });

    it("clicking the ban or unban button calls Modal.createDialog with the correct arguments if user is not banned", async () => {
        createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: jest.fn() });

        renderComponent({ room: mockSpace });
        await userEvent.click(screen.getByText(/ban from/i));

        // check the last call arguments and the presence of the spaceChildFilter callback
        expect(createDialogSpy).toHaveBeenLastCalledWith(
            expect.any(Function),
            expect.objectContaining({ spaceChildFilter: expect.any(Function) }),
            "mx_ConfirmSpaceUserActionDialog_wrapper",
        );

        // test the spaceChildFilter callback
        const callback = createDialogSpy.mock.lastCall[1].spaceChildFilter;

        // make dummy values for myMember and theirMember, then we will test
        // null vs their member followed by
        // truthy my member vs their member
        const mockMyMember = { powerLevel: 1 };
        const mockTheirMember = { membership: "is not ban", powerLevel: 0 };

        const mockRoom = {
            getMember: jest
                .fn()
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(mockTheirMember)
                .mockReturnValueOnce(mockMyMember)
                .mockReturnValueOnce(mockTheirMember),
            currentState: {
                hasSufficientPowerLevelFor: jest.fn().mockReturnValue(true),
            },
        };

        expect(callback(mockRoom)).toBe(false);
        expect(callback(mockRoom)).toBe(true);
    });

    it("clicking the ban or unban button calls Modal.createDialog with the correct arguments if user _is_ banned", async () => {
        createDialogSpy.mockReturnValueOnce({ finished: Promise.resolve([]), close: jest.fn() });

        renderComponent({ room: mockSpace, member: memberWithBanMembership });
        await userEvent.click(screen.getByText(/ban from/i));

        // check the last call arguments and the presence of the spaceChildFilter callback
        expect(createDialogSpy).toHaveBeenLastCalledWith(
            expect.any(Function),
            expect.objectContaining({ spaceChildFilter: expect.any(Function) }),
            "mx_ConfirmSpaceUserActionDialog_wrapper",
        );

        // test the spaceChildFilter callback
        const callback = createDialogSpy.mock.lastCall[1].spaceChildFilter;

        // make dummy values for myMember and theirMember, then we will test
        // null vs their member followed by
        // my member vs their member
        const mockMyMember = { powerLevel: 1 };
        const mockTheirMember = { membership: KnownMembership.Ban, powerLevel: 0 };

        const mockRoom = {
            getMember: jest
                .fn()
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(mockTheirMember)
                .mockReturnValueOnce(mockMyMember)
                .mockReturnValueOnce(mockTheirMember),
            currentState: {
                hasSufficientPowerLevelFor: jest.fn().mockReturnValue(true),
            },
        };

        expect(callback(mockRoom)).toBe(false);
        expect(callback(mockRoom)).toBe(true);
    });
});

describe("<RoomAdminToolsContainer />", () => {
    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    defaultMember.membership = KnownMembership.Invite;

    let defaultProps: Parameters<typeof RoomAdminToolsContainer>[0];
    beforeEach(() => {
        defaultProps = {
            room: mockRoom,
            member: defaultMember,
            isUpdating: false,
            startUpdating: jest.fn(),
            stopUpdating: jest.fn(),
            powerLevels: {},
        };
    });

    const renderComponent = (props = {}) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<RoomAdminToolsContainer {...defaultProps} {...props} />, {
            wrapper: Wrapper,
        });
    };

    it("returns a single empty div if room.getMember is falsy", () => {
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchInlineSnapshot(`
            <DocumentFragment>
              <div />
            </DocumentFragment>
        `);
    });

    it("can return a single empty div in case where room.getMember is not falsy", () => {
        mockRoom.getMember.mockReturnValueOnce(defaultMember);
        const { asFragment } = renderComponent();
        expect(asFragment()).toMatchInlineSnapshot(`
            <DocumentFragment>
              <div />
            </DocumentFragment>
        `);
    });

    it("returns kick, redact messages, ban buttons if conditions met", () => {
        const mockMeMember = new RoomMember(mockRoom.roomId, "arbitraryId");
        mockMeMember.powerLevel = 51; // defaults to 50
        mockRoom.getMember.mockReturnValueOnce(mockMeMember);

        const defaultMemberWithPowerLevel = { ...defaultMember, powerLevel: 0 };

        renderComponent({ member: defaultMemberWithPowerLevel });

        expect(screen.getByRole("button", { name: "Disinvite from room" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ban from room" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Remove messages" })).toBeInTheDocument();
    });

    it("should show BulkRedactDialog upon clicking the Remove messages button", async () => {
        const spy = jest.spyOn(Modal, "createDialog");

        mockClient.getRoom.mockReturnValue(mockRoom);
        mockClient.getUserId.mockReturnValue("@arbitraryId:server");
        const mockMeMember = new RoomMember(mockRoom.roomId, mockClient.getUserId()!);
        mockMeMember.powerLevel = 51; // defaults to 50
        const defaultMemberWithPowerLevel = { ...defaultMember, powerLevel: 0 } as RoomMember;
        mockRoom.getMember.mockImplementation((userId) =>
            userId === mockClient.getUserId() ? mockMeMember : defaultMemberWithPowerLevel,
        );

        renderComponent({ member: defaultMemberWithPowerLevel });
        await userEvent.click(screen.getByRole("button", { name: "Remove messages" }));

        expect(spy).toHaveBeenCalledWith(
            BulkRedactDialog,
            expect.objectContaining({ member: defaultMemberWithPowerLevel }),
        );
    });

    it("returns mute toggle button if conditions met", () => {
        const mockMeMember = new RoomMember(mockRoom.roomId, "arbitraryId");
        mockMeMember.powerLevel = 51; // defaults to 50
        mockRoom.getMember.mockReturnValueOnce(mockMeMember);

        const defaultMemberWithPowerLevelAndJoinMembership = {
            ...defaultMember,
            powerLevel: 0,
            membership: KnownMembership.Join,
        };

        renderComponent({
            member: defaultMemberWithPowerLevelAndJoinMembership,
            powerLevels: { events: { "m.room.power_levels": 1 } },
        });

        const button = screen.getByText(/mute/i);
        expect(button).toBeInTheDocument();
        fireEvent.click(button);
        expect(defaultProps.startUpdating).toHaveBeenCalled();
    });

    it("should disable buttons when isUpdating=true", () => {
        const mockMeMember = new RoomMember(mockRoom.roomId, "arbitraryId");
        mockMeMember.powerLevel = 51; // defaults to 50
        mockRoom.getMember.mockReturnValueOnce(mockMeMember);

        const defaultMemberWithPowerLevelAndJoinMembership = {
            ...defaultMember,
            powerLevel: 0,
            membership: KnownMembership.Join,
        };

        renderComponent({
            member: defaultMemberWithPowerLevelAndJoinMembership,
            powerLevels: { events: { "m.room.power_levels": 1 } },
            isUpdating: true,
        });

        const button = screen.getByRole("button", { name: "Mute" });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it("should not show mute button for one's own member", () => {
        const mockMeMember = new RoomMember(mockRoom.roomId, mockClient.getSafeUserId());
        mockMeMember.powerLevel = 51; // defaults to 50
        mockRoom.getMember.mockReturnValueOnce(mockMeMember);

        renderComponent({
            member: mockMeMember,
            powerLevels: { events: { "m.room.power_levels": 100 } },
        });

        const button = screen.queryByText(/mute/i);
        expect(button).not.toBeInTheDocument();
    });
});

describe("disambiguateDevices", () => {
    it("does not add ambiguous key to unique names", () => {
        const initialDevices = [
            { deviceId: "id1", displayName: "name1" } as Device,
            { deviceId: "id2", displayName: "name2" } as Device,
            { deviceId: "id3", displayName: "name3" } as Device,
        ];
        disambiguateDevices(initialDevices);

        // mutates input so assert against initialDevices
        initialDevices.forEach((device) => {
            expect(device).not.toHaveProperty("ambiguous");
        });
    });

    it("adds ambiguous key to all ids with non-unique names", () => {
        const uniqueNameDevices = [
            { deviceId: "id3", displayName: "name3" } as Device,
            { deviceId: "id4", displayName: "name4" } as Device,
            { deviceId: "id6", displayName: "name6" } as Device,
        ];
        const nonUniqueNameDevices = [
            { deviceId: "id1", displayName: "nonUnique" } as Device,
            { deviceId: "id2", displayName: "nonUnique" } as Device,
            { deviceId: "id5", displayName: "nonUnique" } as Device,
        ];
        const initialDevices = [...uniqueNameDevices, ...nonUniqueNameDevices];
        disambiguateDevices(initialDevices);

        // mutates input so assert against initialDevices
        uniqueNameDevices.forEach((device) => {
            expect(device).not.toHaveProperty("ambiguous");
        });
        nonUniqueNameDevices.forEach((device) => {
            expect(device).toHaveProperty("ambiguous", true);
        });
    });
});

describe("isMuted", () => {
    // this member has a power level of 0
    const isMutedMember = new RoomMember(defaultRoomId, defaultUserId);

    it("returns false if either argument is falsy", () => {
        // @ts-ignore to let us purposely pass incorrect args
        expect(isMuted(isMutedMember, null)).toBe(false);
        // @ts-ignore to let us purposely pass incorrect args
        expect(isMuted(null, {})).toBe(false);
    });

    it("when powerLevelContent.events and .events_default are undefined, returns false", () => {
        const powerLevelContents = {};
        expect(isMuted(isMutedMember, powerLevelContents)).toBe(false);
    });

    it("when powerLevelContent.events is undefined, uses .events_default", () => {
        const higherPowerLevelContents = { events_default: 10 };
        expect(isMuted(isMutedMember, higherPowerLevelContents)).toBe(true);

        const lowerPowerLevelContents = { events_default: -10 };
        expect(isMuted(isMutedMember, lowerPowerLevelContents)).toBe(false);
    });

    it("when powerLevelContent.events is defined but '.m.room.message' isn't, uses .events_default", () => {
        const higherPowerLevelContents = { events: {}, events_default: 10 };
        expect(isMuted(isMutedMember, higherPowerLevelContents)).toBe(true);

        const lowerPowerLevelContents = { events: {}, events_default: -10 };
        expect(isMuted(isMutedMember, lowerPowerLevelContents)).toBe(false);
    });

    it("when powerLevelContent.events and '.m.room.message' are defined, uses the value", () => {
        const higherPowerLevelContents = { events: { "m.room.message": -10 }, events_default: 10 };
        expect(isMuted(isMutedMember, higherPowerLevelContents)).toBe(false);

        const lowerPowerLevelContents = { events: { "m.room.message": 10 }, events_default: -10 };
        expect(isMuted(isMutedMember, lowerPowerLevelContents)).toBe(true);
    });
});

describe("getPowerLevels", () => {
    it("returns an empty object when room.currentState.getStateEvents return null", () => {
        mockRoom.currentState.getStateEvents.mockReturnValueOnce(null);
        expect(getPowerLevels(mockRoom)).toEqual({});
    });
});
