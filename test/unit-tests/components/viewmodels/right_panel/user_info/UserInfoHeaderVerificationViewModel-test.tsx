/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Device, type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { mocked, type Mocked } from "jest-mock";
import { UserVerificationStatus, type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { renderHook } from "jest-matrix-react";

import { withClientContextRenderOptions } from "../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { useUserfoHeaderViewModel } from "../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoHeaderViewModel";
import { useUserInfoVerificationSection } from "../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoHeaderVerificationViewModel";

jest.mock("../../../../../../src/customisations/UserIdentifier", () => {
    return {
        getDisplayUserIdentifier: jest.fn().mockReturnValue("customUserIdentifier"),
    };
});

describe("useUserInfoHeaderViewModel", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";

    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    const defaultProps = {
        devices: [] as Device[],
        member: defaultMember
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

        mockClient.doesServerSupportUnstableFeature.mockResolvedValue(true);
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const renderUserInfoHeaderVerificationHook = (props = defaultProps) => {
        return renderHook(() => useUserInfoVerificationSection(props.member, props.devices), withClientContextRenderOptions(mockClient));
    };

    it("should be able to verify user", () => {
        const notMeId = "@notMe";
        const notMetMember = new RoomMember(notMeId, defaultUserId);
        const device1 = new Device({
            deviceId: "d1",
            userId: notMeId,
            displayName: "my device",
            algorithms: [],
            keys: new Map(),
        });
        mockCrypto.getUserVerificationStatus.mockResolvedValue(new UserVerificationStatus(true, true, false));

        jest.spyOn(mockClient, "getUserId").mockReturnValue(defaultMember.userId);

        const { result } = renderUserInfoHeaderVerificationHook({ member: notMetMember, devices: [device1] });
        const canVerify = result.current.canVerify;

        expect(canVerify).toBeTruthy();
        
    });
    
    it("should not be able to verify user if user is not me", () => {

    });
    
    it("should not be able to verify user if im already verified", () => {

    });
    
    it("should not be able to verify user there is no devices", () => {

    });
    
    it("should get correct hasCrossSigningKeys values", () => {

    });
});
