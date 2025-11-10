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
import {
    type Room,
    User,
    type MatrixClient,
    RoomMember,
    Device,
    ProfileKeyTimezone,
    ProfileKeyMSC4175Timezone,
} from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "events";
import {
    UserVerificationStatus,
    type VerificationRequest,
    VerificationPhase as Phase,
    VerificationRequestEvent,
    type CryptoApi,
} from "matrix-js-sdk/src/crypto-api";

import UserInfo, { disambiguateDevices } from "../../../../../src/components/views/right_panel/UserInfo";
import { getPowerLevels } from "../../../../../src/components/viewmodels/right_panel/user_info/UserInfoBasicViewModel";
import { RightPanelPhases } from "../../../../../src/stores/right-panel/RightPanelStorePhases";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import Modal from "../../../../../src/Modal";
import { clearAllModals, flushPromises } from "../../../../test-utils";
import ErrorDialog from "../../../../../src/components/views/dialogs/ErrorDialog";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../../src/settings/UIFeature";

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
        getExtendedProfile: jest.fn().mockRejectedValue(new Error("Not supported")),
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

        describe.each([[ProfileKeyTimezone], [ProfileKeyMSC4175Timezone]])("timezone rendering (%s)", (profileKey) => {
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
                mockClient.getExtendedProfile.mockResolvedValue({ [profileKey]: "Europe/London" });
                renderComponent();
                await expect(screen.findByText(/\d\d:\d\d (AM|PM)/)).resolves.toBeInTheDocument();
            });

            it("does not renders user timezone if timezone is invalid", async () => {
                mockClient.doesServerSupportExtendedProfiles.mockResolvedValue(true);
                mockClient.getExtendedProfile.mockResolvedValue({ [profileKey]: "invalid-tz" });
                renderComponent();
                expect(screen.queryByText(/\d\d:\d\d (AM|PM)/)).not.toBeInTheDocument();
            });
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
