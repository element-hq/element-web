/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type Mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { Device, RoomMember } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen } from "jest-matrix-react";
import React from "react";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { UserInfoHeaderView } from "../../../../../src/components/views/right_panel/user_info/UserInfoHeaderView";
import { createTestClient } from "../../../../test-utils";
import { useUserfoHeaderViewModel } from "../../../../../src/components/viewmodels/right_panel/user_info/UserInfoHeaderViewModel";

// Mock the viewmodel hooks
jest.mock("../../../../../src/components/viewmodels/right_panel/user_info/UserInfoHeaderViewModel", () => ({
    useUserfoHeaderViewModel: jest.fn().mockReturnValue({
        onMemberAvatarClick: jest.fn(),
        precenseInfo: {
            lastActiveAgo: undefined,
            currentlyActive: undefined,
            state: undefined,
        },
        showPresence: false,
        timezoneInfo: null,
        userIdentifier: "customUserIdentifier",
    }),
}));

describe("<UserInfoHeaderView />", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    const defaultProps = {
        member: defaultMember,
        roomId: defaultRoomId,
    };

    let mockClient: MatrixClient;
    let mockCrypto: Mocked<CryptoApi>;

    beforeEach(() => {
        mockCrypto = mocked({
            bootstrapSecretStorage: jest.fn(),
            bootstrapCrossSigning: jest.fn(),
            getCrossSigningKeyId: jest.fn(),
            getVerificationRequestsToDeviceInProgress: jest.fn().mockReturnValue([]),
            getUserDeviceInfo: jest.fn(),
            getDeviceVerificationStatus: jest.fn(),
            getUserVerificationStatus: jest.fn(),
            isDehydrationSupported: jest.fn().mockResolvedValue(false),
            startDehydration: jest.fn(),
            getKeyBackupInfo: jest.fn().mockResolvedValue(null),
            userHasCrossSigningKeys: jest.fn().mockResolvedValue(false),
        } as unknown as CryptoApi);

        mockClient = createTestClient();
        mockClient.doesServerSupportExtendedProfiles = () => Promise.resolve(false);

        jest.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);
        jest.spyOn(mockClient.secretStorage, "hasKey").mockResolvedValue(true);
        jest.spyOn(mockClient, "getCrypto").mockReturnValue(mockCrypto);
        jest.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    const renderComponent = (
        props = {
            hideVerificationSection: false,
        },
    ) => {
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

        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(
            <UserInfoHeaderView
                {...defaultProps}
                {...props}
                devices={[device1]}
                hideVerificationSection={props.hideVerificationSection}
            />,
            {
                wrapper: Wrapper,
            },
        );
    };

    it("renders custom user identifiers in the header", () => {
        const { container } = renderComponent();
        expect(screen.getByText("customUserIdentifier")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("should not render verification view if hideVerificationSection is true", () => {
        mocked(useUserfoHeaderViewModel).mockReturnValue({
            onMemberAvatarClick: jest.fn(),
            precenseInfo: {
                lastActiveAgo: undefined,
                currentlyActive: undefined,
                state: undefined,
            },
            showPresence: false,
            timezoneInfo: null,
            userIdentifier: "null",
        });

        const { container } = renderComponent({ hideVerificationSection: true });
        const verificationClass = container.getElementsByClassName("mx_UserInfo_verification").length;

        expect(verificationClass).toEqual(0);
    });

    it("should render timezone if it exist", () => {
        mocked(useUserfoHeaderViewModel).mockReturnValue({
            onMemberAvatarClick: jest.fn(),
            precenseInfo: {
                lastActiveAgo: undefined,
                currentlyActive: undefined,
                state: undefined,
            },
            showPresence: false,
            timezoneInfo: {
                timezone: "FR",
                friendly: "paris",
            },
            userIdentifier: null,
        });

        renderComponent({ hideVerificationSection: false });
        expect(screen.getByText("paris")).toBeInTheDocument();
    });

    it("should render correct presence label", () => {
        mocked(useUserfoHeaderViewModel).mockReturnValue({
            onMemberAvatarClick: jest.fn(),
            precenseInfo: {
                lastActiveAgo: 0,
                currentlyActive: true,
                state: "online",
            },
            showPresence: true,
            timezoneInfo: null,
            userIdentifier: null,
        });

        renderComponent({ hideVerificationSection: false });
        expect(screen.getByText("Online")).toBeInTheDocument();
    });

    it("should be able to click on member avatar", () => {
        const onMemberAvatarClick = jest.fn();
        mocked(useUserfoHeaderViewModel).mockReturnValue({
            onMemberAvatarClick,
            precenseInfo: {
                lastActiveAgo: undefined,
                currentlyActive: undefined,
                state: undefined,
            },
            showPresence: false,
            timezoneInfo: {
                timezone: "FR",
                friendly: "paris",
            },
            userIdentifier: null,
        });
        renderComponent();
        const avatar = screen.getByRole("button", { name: "Profile picture" });

        fireEvent.click(avatar);

        expect(onMemberAvatarClick).toHaveBeenCalled();
    });
});
