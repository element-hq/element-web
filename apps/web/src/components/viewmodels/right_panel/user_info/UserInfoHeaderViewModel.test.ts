/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from "vitest";
import { type MatrixClient, RoomMember } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { renderHook } from "test-utils-rtl";
import { withClientContextRenderOptions } from "test-utils";

import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { useUserfoHeaderViewModel } from "./UserInfoHeaderViewModel";
import * as UseTimezone from "../../../../hooks/useUserTimezone";
import SdkConfig from "../../../../SdkConfig";
import Modal from "../../../../Modal";
import MediaPreviewDialog from "../../../views/elements/MediaPreview/MediaPreviewDialog";
import * as Media from "../../../../customisations/Media";
import { type IConfigOptions } from "../../../../IConfigOptions";

vi.mock("../../../../customisations/UserIdentifier", () => {
    return {
        default: {
            getDisplayUserIdentifier: vi.fn().mockReturnValue("customUserIdentifier"),
        },
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
            getExtendedProfileProperty: vi.fn().mockRejectedValue(new Error("Not supported")),
            mxcUrlToHttp: vi.fn().mockReturnValue(mockAvatarUrl),
            removeListener: vi.fn(),
            currentState: {
                on: vi.fn(),
            },
            getRoom: vi.fn(),
            credentials: {},
            setPowerLevel: vi.fn(),
            getCrypto: vi.fn().mockReturnValue(mockCrypto),
            baseUrl: "homeserver.url",
        } as unknown as MatrixClient);

        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const renderUserInfoHeaderViewModelHook = (props = defaultProps) => {
        return renderHook(() => useUserfoHeaderViewModel(props), withClientContextRenderOptions(mockClient));
    };
    it("should give user timezone info", () => {
        const defaultTZ = { timezone: "FR", friendly: "fr" };
        vi.spyOn(UseTimezone, "useUserTimezone").mockReturnValue(defaultTZ);

        const { result } = renderUserInfoHeaderViewModelHook();
        const timezone = result.current.timezoneInfo;

        expect(UseTimezone.useUserTimezone).toHaveBeenCalledWith(mockClient, defaultMember.userId);
        expect(timezone).toEqual(defaultTZ);
    });

    it("should give correct showPresence value based on enablePresenceByHsUrl", () => {
        vi.spyOn(SdkConfig, "get").mockImplementation((key: string) => {
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
        vi.spyOn(SdkConfig, "get").mockImplementation(() => false);
        const { result } = renderUserInfoHeaderViewModelHook();
        const showPresence = result.current.showPresence;
        expect(showPresence).toBeTruthy();
    });

    it("should open image dialog when avatar is clicked", () => {
        const props = Object.assign({}, defaultProps);
        const spyModale = vi.spyOn(Modal, "createDialog");
        const spyMedia = vi.spyOn(Media, "mediaFromMxc");
        vi.spyOn(props.member, "getMxcAvatarUrl").mockReturnValue(mockAvatarUrl);

        const { result } = renderUserInfoHeaderViewModelHook(props);

        result.current.onMemberAvatarClick();

        expect(spyModale).toHaveBeenCalledWith(
            MediaPreviewDialog,
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
        const spyModale = vi.spyOn(Modal, "createDialog");
        vi.spyOn(props.member, "getMxcAvatarUrl").mockReturnValue(mockAvatarUrl);
        vi.spyOn(Media, "mediaFromMxc").mockReturnValue({
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
