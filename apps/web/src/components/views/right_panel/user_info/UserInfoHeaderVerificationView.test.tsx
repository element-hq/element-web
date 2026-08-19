/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { UserVerificationStatus, type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { Device, RoomMember } from "matrix-js-sdk/src/matrix";
import { render, waitFor, screen } from "test-utils-rtl";
import React from "react";

import { clientAndSDKContextRenderOptions, createTestClient, TestSDKContext } from "test-utils";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { UserInfoHeaderVerificationView } from "./UserInfoHeaderVerificationView";

describe("<UserInfoHeaderVerificationView />", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

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
        sdkContext = new TestSDKContext();
        sdkContext._client = mockClient;
        vi.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);
        vi.spyOn(mockClient.secretStorage, "hasKey").mockResolvedValue(true);
        vi.spyOn(mockClient, "getCrypto").mockReturnValue(mockCrypto);
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
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
        vi.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);

        return render(
            <UserInfoHeaderVerificationView member={defaultMember} devices={[device1]} />,
            clientAndSDKContextRenderOptions(mockClient, sdkContext),
        );
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
