/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, act, waitForElementToBeRemoved } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type Mocked, mocked } from "jest-mock";
import { type Room, User, type MatrixClient, RoomMember, Device } from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "events";
import {
    UserVerificationStatus,
    type VerificationRequest,
    VerificationPhase as Phase,
    VerificationRequestEvent,
    type CryptoApi,
} from "matrix-js-sdk/src/crypto-api";

import UserInfo, {
    disambiguateDevices,
    getPowerLevels,
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

describe("getPowerLevels", () => {
    it("returns an empty object when room.currentState.getStateEvents return null", () => {
        mockRoom.currentState.getStateEvents.mockReturnValueOnce(null);
        expect(getPowerLevels(mockRoom)).toEqual({});
    });
});
