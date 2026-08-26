/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi, type Mocked } from "vitest";
import { render, screen, act, waitForElementToBeRemoved } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import {
    type Room,
    User,
    type MatrixClient,
    RoomMember,
    Device,
    ProfileKeyTimezone,
    ProfileKeyMSC4175Timezone,
} from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "node:events";
import {
    UserVerificationStatus,
    type VerificationRequest,
    VerificationPhase as Phase,
    VerificationRequestEvent,
    type CryptoApi,
} from "matrix-js-sdk/src/crypto-api";
import { clearAllModals, clientAndSDKContextRenderOptions, flushPromises, TestSDKContext } from "test-utils";

import UserInfo, { disambiguateDevices } from "./UserInfo";
import { getPowerLevels } from "../../viewmodels/right_panel/user_info/UserInfoBasicViewModel";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import ErrorDialog from "../dialogs/ErrorDialog";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";

vi.mock("../../../utils/direct-messages", async () => ({
    ...(await vi.importActual("../../../utils/direct-messages")),
    startDmOnFirstMessage: vi.fn(),
}));

vi.mock("../../../dispatcher/dispatcher");

vi.mock("../../../customisations/UserIdentifier", () => {
    return {
        default: {
            getDisplayUserIdentifier: vi.fn().mockReturnValue("customUserIdentifier"),
        },
    };
});

vi.mock("../../../utils/DMRoomMap", () => {
    const mock = {
        getUserIdForRoomId: vi.fn(),
        getDMRoomsForUserId: vi.fn(),
    };

    return {
        default: {
            shared: vi.fn().mockReturnValue(mock),
            sharedInstance: mock,
        },
    };
});

vi.mock("../../../customisations/helpers/UIComponents", async () => {
    const original = await vi.importActual<typeof import("../../../customisations/helpers/UIComponents")>(
        "../../../customisations/helpers/UIComponents",
    );
    return {
        shouldShowComponent: vi.fn().mockImplementation(original.shouldShowComponent),
    };
});

const defaultRoomId = "!fkfk";
const defaultUserId = "@user:example.com";
const defaultUser = new User(defaultUserId);

let mockRoom: Mocked<Room>;
let mockClient: Mocked<MatrixClient>;
let mockCrypto: Mocked<CryptoApi>;
let sdkContext: TestSDKContext;
const origDate = global.Date.prototype.toLocaleString;

beforeEach(() => {
    mockRoom = vi.mocked({
        roomId: defaultRoomId,
        getType: vi.fn().mockReturnValue(undefined),
        isSpaceRoom: vi.fn().mockReturnValue(false),
        getMember: vi.fn().mockReturnValue(undefined),
        getMxcAvatarUrl: vi.fn().mockReturnValue("mock-avatar-url"),
        name: "test room",
        on: vi.fn(),
        off: vi.fn(),
        currentState: {
            getStateEvents: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
        },
        getEventReadUpTo: vi.fn(),
    } as unknown as Room);

    mockCrypto = vi.mocked({
        getDeviceVerificationStatus: vi.fn(),
        getUserDeviceInfo: vi.fn(),
        userHasCrossSigningKeys: vi.fn().mockResolvedValue(false),
        getUserVerificationStatus: vi.fn(),
        isEncryptionEnabledInRoom: vi.fn().mockResolvedValue(false),
    } as unknown as CryptoApi);

    mockClient = vi.mocked({
        getUser: vi.fn(),
        isGuest: vi.fn().mockReturnValue(false),
        isUserIgnored: vi.fn(),
        getIgnoredUsers: vi.fn(),
        setIgnoredUsers: vi.fn(),
        getUserId: vi.fn(),
        getSafeUserId: vi.fn(),
        getDomain: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        isSynapseAdministrator: vi.fn().mockResolvedValue(false),
        doesServerSupportUnstableFeature: vi.fn().mockReturnValue(false),
        doesServerSupportExtendedProfiles: vi.fn().mockResolvedValue(false),
        getExtendedProfile: vi.fn().mockRejectedValue(new Error("Not supported")),
        mxcUrlToHttp: vi.fn().mockReturnValue("mock-mxcUrlToHttp"),
        removeListener: vi.fn(),
        currentState: {
            on: vi.fn(),
        },
        getRoom: vi.fn(),
        credentials: {},
        setPowerLevel: vi.fn(),
        getCrypto: vi.fn().mockReturnValue(mockCrypto),
    } as unknown as MatrixClient);
    sdkContext = new TestSDKContext();
    sdkContext._client = mockClient;

    vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
    vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
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
                otherPartySupportsMethod: vi.fn(),
                generateQRCode: vi.fn().mockReturnValue(new Promise(() => {})),
                ...opts,
            });
        }
    }
    let verificationRequest: MockVerificationRequest;

    const defaultProps = {
        user: defaultUser,
        // idk what is wrong with this type
        phase: RightPanelPhases.MemberInfo as RightPanelPhases.MemberInfo,
        onClose: vi.fn(),
    };

    const renderComponent = (props = {}) => {
        return render(
            <UserInfo {...defaultProps} {...props} />,
            clientAndSDKContextRenderOptions(mockClient, sdkContext),
        );
    };

    beforeEach(() => {
        verificationRequest = new MockVerificationRequest({});
    });

    afterEach(async () => {
        await clearAllModals();
        vi.clearAllMocks();
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
                vi.spyOn(global.Date.prototype, "toLocaleString").mockImplementation(
                    function (this: Date, _locale, opts) {
                        return origDate.call(this, "en-US", {
                            ...opts,
                            hourCycle: "h12",
                        });
                    },
                );
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

            const spy = vi.spyOn(Modal, "createDialog");
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

            const spy = vi.spyOn(Modal, "createDialog");

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
            render(<UserInfo {...defaultProps} />, clientAndSDKContextRenderOptions(mockClient, sdkContext));

            expect(screen.getByRole("button", { name: "Send message" })).toBeVisible();
        });

        it("hides the message button if the visibility customisation hides all create room features", () => {
            vi.mocked(shouldShowComponent).withImplementation(
                (component) => {
                    return component !== UIComponent.CreateRooms;
                },
                () => {
                    render(<UserInfo {...defaultProps} />, clientAndSDKContextRenderOptions(mockClient, sdkContext));

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
                const modalSpy = (Modal.createDialog = vi.fn().mockReturnValue({
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
                const modalSpy = (Modal.createDialog = vi.fn().mockReturnValue({
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
            await expect(
                screen.findByText("User verification unavailable", { exact: false }),
            ).resolves.toBeInTheDocument();
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
        vi.mocked(mockRoom.currentState.getStateEvents).mockReturnValueOnce(null);
        expect(getPowerLevels(mockRoom)).toEqual({});
    });
});
