/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { Device, RoomMember } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen } from "test-utils-rtl";
import React from "react";

import { clientAndSDKContextRenderOptions, createTestClient, TestSDKContext } from "test-utils";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { UserInfoHeaderView } from "./UserInfoHeaderView";
import { useUserfoHeaderViewModel } from "../../../viewmodels/right_panel/user_info/UserInfoHeaderViewModel";

// Mock the viewmodel hooks
vi.mock("../../../viewmodels/right_panel/user_info/UserInfoHeaderViewModel", () => ({
    useUserfoHeaderViewModel: vi.fn().mockReturnValue({
        onMemberAvatarClick: vi.fn(),
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
    let sdkContext: TestSDKContext;

    beforeEach(() => {
        mockCrypto = vi.mocked({
            bootstrapSecretStorage: vi.fn(),
            bootstrapCrossSigning: vi.fn(),
            getCrossSigningKeyId: vi.fn(),
            getVerificationRequestsToDeviceInProgress: vi.fn().mockReturnValue([]),
            getUserDeviceInfo: vi.fn(),
            getDeviceVerificationStatus: vi.fn(),
            getUserVerificationStatus: vi.fn(),
            isDehydrationSupported: vi.fn().mockResolvedValue(false),
            startDehydration: vi.fn(),
            getKeyBackupInfo: vi.fn().mockResolvedValue(null),
            userHasCrossSigningKeys: vi.fn().mockResolvedValue(false),
        } as unknown as CryptoApi);

        mockClient = createTestClient();
        mockClient.doesServerSupportExtendedProfiles = () => Promise.resolve(false);
        sdkContext = new TestSDKContext();
        sdkContext._client = mockClient;

        vi.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);
        vi.spyOn(mockClient.secretStorage, "hasKey").mockResolvedValue(true);
        vi.spyOn(mockClient, "getCrypto").mockReturnValue(mockCrypto);
        vi.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
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

        return render(
            <UserInfoHeaderView
                {...defaultProps}
                {...props}
                devices={[device1]}
                hideVerificationSection={props.hideVerificationSection}
            />,
            clientAndSDKContextRenderOptions(mockClient, sdkContext),
        );
    };

    it("renders custom user identifiers in the header", () => {
        const { container } = renderComponent();
        expect(screen.getByText("customUserIdentifier")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("should not render verification view if hideVerificationSection is true", () => {
        vi.mocked(useUserfoHeaderViewModel).mockReturnValue({
            onMemberAvatarClick: vi.fn(),
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
        vi.mocked(useUserfoHeaderViewModel).mockReturnValue({
            onMemberAvatarClick: vi.fn(),
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
        vi.mocked(useUserfoHeaderViewModel).mockReturnValue({
            onMemberAvatarClick: vi.fn(),
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
        const onMemberAvatarClick = vi.fn();
        vi.mocked(useUserfoHeaderViewModel).mockReturnValue({
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
