/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Device, type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { type Mocked } from "jest-mock";
import { UserVerificationStatus, type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { renderHook, waitFor } from "jest-matrix-react";

import { createTestClient, withClientContextRenderOptions } from "../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { useUserInfoVerificationViewModel } from "../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoHeaderVerificationViewModel";

describe("useUserInfoVerificationHeaderViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    const defaultProps = {
        devices: [] as Device[],
        member: defaultMember,
    };
    let mockClient: MatrixClient;
    let mockCrypto: Mocked<CryptoApi>;

    beforeEach(() => {
        mockCrypto = {
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
        } as unknown as Mocked<CryptoApi>;

        mockClient = createTestClient();
        jest.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);
        jest.spyOn(mockClient.secretStorage, "hasKey").mockResolvedValue(true);
        jest.spyOn(mockClient, "getCrypto").mockReturnValue(mockCrypto);
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const renderUserInfoHeaderVerificationHook = (props = defaultProps) => {
        return renderHook(
            () => useUserInfoVerificationViewModel(props.member, props.devices),
            withClientContextRenderOptions(mockClient),
        );
    };

    it("should be able to verify user", async () => {
        const notMeId = "@notMe";
        const notMetMember = new RoomMember(defaultRoomId, notMeId);
        const device1 = new Device({
            deviceId: "d1",
            userId: notMeId,
            displayName: "my device",
            algorithms: [],
            keys: new Map(),
        });

        // mock the user as not verified
        jest.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false),
        );

        jest.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

        // the selected user is not the default user, so he can make user verification
        const { result } = renderUserInfoHeaderVerificationHook({ member: notMetMember, devices: [device1] });
        await waitFor(() => {
            const canVerify = result.current.canVerify;

            expect(canVerify).toBeTruthy();
        });
    });

    it("should not be able to verify user if user is not me", async () => {
        const device1 = new Device({
            deviceId: "d1",
            userId: defaultMember.userId,
            displayName: "my device",
            algorithms: [],
            keys: new Map(),
        });

        // mock the user as not verified
        jest.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false),
        );

        jest.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

        const { result } = renderUserInfoHeaderVerificationHook({ member: defaultMember, devices: [device1] });
        await waitFor(() => {
            const canVerify = result.current.canVerify;

            expect(canVerify).toBeFalsy();
            // if we cant verify the user the hasCrossSigningKeys value should also be undefined
            expect(result.current.hasCrossSigningKeys).toBeUndefined();
        });
    });

    it("should not be able to verify user if im already verified", async () => {
        const notMeId = "@notMe";
        const notMetMember = new RoomMember(defaultRoomId, notMeId);
        const device1 = new Device({
            deviceId: "d1",
            userId: notMeId,
            displayName: "my device",
            algorithms: [],
            keys: new Map(),
        });

        // mock the user as already verified
        jest.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(true, true, false),
        );

        jest.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

        // the selected user is not the default user, so he can make user verification
        const { result } = renderUserInfoHeaderVerificationHook({ member: notMetMember, devices: [device1] });
        await waitFor(() => {
            const canVerify = result.current.canVerify;

            expect(canVerify).toBeFalsy();
            // if we cant verify the user the hasCrossSigningKeys value should also be undefined
            expect(result.current.hasCrossSigningKeys).toBeUndefined();
        });
    });

    it("should not be able to verify user there is no devices", async () => {
        const notMeId = "@notMe";
        const notMetMember = new RoomMember(defaultRoomId, notMeId);

        // mock the user as not verified
        jest.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false),
        );

        jest.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

        // the selected user is not the default user, so he can make user verification
        const { result } = renderUserInfoHeaderVerificationHook({ member: notMetMember, devices: [] });
        await waitFor(() => {
            const canVerify = result.current.canVerify;

            expect(canVerify).toBeFalsy();
            // if we cant verify the user the hasCrossSigningKeys value should also be undefined
            expect(result.current.hasCrossSigningKeys).toBeUndefined();
        });
    });

    it("should get correct hasCrossSigningKeys values", async () => {
        const notMeId = "@notMe";
        const notMetMember = new RoomMember(defaultRoomId, notMeId);
        const device1 = new Device({
            deviceId: "d1",
            userId: notMeId,
            displayName: "my device",
            algorithms: [],
            keys: new Map(),
        });

        // mock the user as not verified
        jest.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false),
        );

        jest.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

        jest.spyOn(mockCrypto, "userHasCrossSigningKeys").mockResolvedValue(true);
        const { result } = renderUserInfoHeaderVerificationHook({ member: notMetMember, devices: [device1] });
        await waitFor(() => {
            const hasCrossSigningKeys = result.current.hasCrossSigningKeys;

            expect(hasCrossSigningKeys).toBeTruthy();
        });
    });
});
