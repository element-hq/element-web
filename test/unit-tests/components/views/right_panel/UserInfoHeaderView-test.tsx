/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type Mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/client";
import { UserVerificationStatus, type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { Device, RoomMember } from "matrix-js-sdk/src/matrix";
import { render, waitFor, screen } from "jest-matrix-react";
import React from "react";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { UserInfoHeaderView } from "../../../../../src/components/views/right_panel/user_info/UserInfoHeaderView";


describe("<UserInfoHeader />", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";
    
    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);
    const defaultProps = {
        member: defaultMember,
        roomId: defaultRoomId,
    };

    let mockClient: Mocked<MatrixClient>;
    let mockCrypto: Mocked<CryptoApi>;
    
    beforeEach(() => {
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
            mxcUrlToHttp: jest.fn(),
            removeListener: jest.fn(),
            currentState: {
                on: jest.fn(),
            },
            getRoom: jest.fn(),
            credentials: {},
            setPowerLevel: jest.fn(),
            getCrypto: jest.fn().mockReturnValue(mockCrypto),
            baseUrl: "homeserver.url",
        } as unknown as MatrixClient);

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
        mockClient.doesServerSupportUnstableFeature.mockResolvedValue(true);
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
