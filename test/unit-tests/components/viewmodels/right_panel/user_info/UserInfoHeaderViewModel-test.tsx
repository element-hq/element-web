/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { mocked, type Mocked } from "jest-mock";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { renderHook } from "jest-matrix-react";

import { withClientContextRenderOptions } from "../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { useUserfoHeaderViewModel } from "../../../../../../src/components/viewmodels/right_panel/user_info/UserInfoHeaderViewModel";
import * as UseTimezone from "../../../../../../src/hooks/useUserTimezone";
import SdkConfig from "../../../../../../src/SdkConfig";
import Modal from "../../../../../../src/Modal";
import ImageView from "../../../../../../src/components/views/elements/ImageView";
import * as Media from "../../../../../../src/customisations/Media";
import { type IConfigOptions } from "../../../../../../src/IConfigOptions";

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
        member: defaultMember,
        roomId: defaultRoomId,
    };

    let mockClient: Mocked<MatrixClient>;
    let mockCrypto: Mocked<CryptoApi>;

    const mockAvatarUrl = "mock-avatar-url";
    const oldGet = SdkConfig.get;

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
            mxcUrlToHttp: jest.fn().mockReturnValue(mockAvatarUrl),
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

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const renderUserInfoHeaderViewModelHook = (props = defaultProps) => {
        return renderHook(() => useUserfoHeaderViewModel(props), withClientContextRenderOptions(mockClient));
    };
    it("should give user timezone info", () => {
        const defaultTZ = { timezone: "FR", friendly: "fr" };
        jest.spyOn(UseTimezone, "useUserTimezone").mockReturnValue(defaultTZ);

        const { result } = renderUserInfoHeaderViewModelHook();
        const timezone = result.current.timezoneInfo;

        expect(UseTimezone.useUserTimezone).toHaveBeenCalledWith(mockClient, defaultMember.userId);
        expect(timezone).toEqual(defaultTZ);
    });

    it("should give correct showPresence value based on enablePresenceByHsUrl", () => {
        jest.spyOn(SdkConfig, "get").mockImplementation((key: string) => {
            if (key === "enable_presence_by_hs_url") {
                return {
                    [mockClient.baseUrl]: false,
                };
            }
            return oldGet(key as keyof IConfigOptions);
        });
        const { result } = renderUserInfoHeaderViewModelHook();
        const showPresence = result.current.showPresence;
        expect(showPresence).toBeFalsy();
    });

    it("should have default value true for showPresence", () => {
        jest.spyOn(SdkConfig, "get").mockImplementation(() => false);
        const { result } = renderUserInfoHeaderViewModelHook();
        const showPresence = result.current.showPresence;
        expect(showPresence).toBeTruthy();
    });

    it("should open image dialog when avatar is clicked", () => {
        const props = Object.assign({}, defaultProps);
        const spyModale = jest.spyOn(Modal, "createDialog");
        const spyMedia = jest.spyOn(Media, "mediaFromMxc");
        jest.spyOn(props.member, "getMxcAvatarUrl").mockReturnValue(mockAvatarUrl);

        const { result } = renderUserInfoHeaderViewModelHook(props);

        result.current.onMemberAvatarClick();

        expect(spyModale).toHaveBeenCalledWith(
            ImageView,
            {
                src: mockAvatarUrl,
                name: defaultMember.name,
            },
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
        expect(spyMedia).toHaveBeenCalledWith(mockAvatarUrl);
    });

    it("should not open image dialog when avatar url is null", () => {
        const props = Object.assign({}, defaultProps);
        const spyModale = jest.spyOn(Modal, "createDialog");
        jest.spyOn(props.member, "getMxcAvatarUrl").mockReturnValue(mockAvatarUrl);
        jest.spyOn(Media, "mediaFromMxc").mockReturnValue({
            srcHttp: null,
            isEncrypted: false,
            srcMxc: "",
            thumbnailMxc: undefined,
            hasThumbnail: false,
            thumbnailHttp: null,
            getThumbnailHttp: function (width: number, height: number, mode?: "scale" | "crop"): string | null {
                throw new Error("Function not implemented.");
            },
            getThumbnailOfSourceHttp: function (width: number, height: number, mode?: "scale" | "crop"): string | null {
                throw new Error("Function not implemented.");
            },
            getSquareThumbnailHttp: function (dim: number): string | null {
                throw new Error("Function not implemented.");
            },
            downloadSource: function (): Promise<Response> {
                throw new Error("Function not implemented.");
            },
        });

        const { result } = renderUserInfoHeaderViewModelHook(props);

        result.current.onMemberAvatarClick();

        expect(spyModale).not.toHaveBeenCalled();
    });
});
