/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import { Device, type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { UserVerificationStatus, type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { renderHook, waitFor } from "test-utils-rtl";
import { clientAndSDKContextRenderOptions, createTestClient, TestSDKContext } from "test-utils";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { useUserInfoVerificationViewModel } from "./UserInfoHeaderVerificationViewModel";

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
    let sdkContext: TestSDKContext;

    beforeEach(() => {
        mockCrypto = {
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
        } as unknown as Mocked<CryptoApi>;

        mockClient = createTestClient();
        sdkContext = new TestSDKContext();
        sdkContext._client = mockClient;

        vi.spyOn(mockClient, "doesServerSupportUnstableFeature").mockResolvedValue(true);
        vi.spyOn(mockClient.secretStorage, "hasKey").mockResolvedValue(true);
        vi.spyOn(mockClient, "getCrypto").mockReturnValue(mockCrypto);
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const renderUserInfoHeaderVerificationHook = (props = defaultProps) => {
        return renderHook(
            () => useUserInfoVerificationViewModel(props.member, props.devices),
            clientAndSDKContextRenderOptions(mockClient, sdkContext),
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
        vi.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false),
        );

        vi.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

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
        vi.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false),
        );

        vi.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

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
        vi.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(true, true, false),
        );

        vi.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

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
        vi.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false),
        );

        vi.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

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
        vi.spyOn(mockCrypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false),
        );

        vi.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

        vi.spyOn(mockCrypto, "userHasCrossSigningKeys").mockResolvedValue(true);
        const { result } = renderUserInfoHeaderVerificationHook({ member: notMetMember, devices: [device1] });
        await waitFor(() => {
            const hasCrossSigningKeys = result.current.hasCrossSigningKeys;

            expect(hasCrossSigningKeys).toBeTruthy();
        });
    });
});
