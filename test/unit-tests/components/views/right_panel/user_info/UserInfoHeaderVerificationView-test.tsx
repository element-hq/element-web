/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked, type Mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { UserVerificationStatus, type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { Device, RoomMember } from "matrix-js-sdk/src/matrix";
import { render, waitFor, screen } from "jest-matrix-react";
import React from "react";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { UserInfoHeaderVerificationView } from "../../../../../src/components/views/right_panel/user_info/UserInfoHeaderVerificationView";
import { createTestClient } from "../../../../test-utils";

describe("<UserInfoHeaderVerificationView />", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

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
        jest.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);
        jest.spyOn(mockClient.secretStorage, "hasKey").mockResolvedValue(true);
        jest.spyOn(mockClient, "getCrypto").mockReturnValue(mockCrypto);
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    const renderComponent = () => {
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
        jest.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<UserInfoHeaderVerificationView member={defaultMember} devices={[device1]} />, {
            wrapper: Wrapper,
        });
    };

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
