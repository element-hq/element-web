/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { useCallback, useContext } from "react";
import { type UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import { mediaFromMxc } from "../../../../customisations/Media";
import Modal from "../../../../Modal";
import ImageView from "../../../views/elements/ImageView";
import SdkConfig from "../../../../SdkConfig";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { type IDevice, type Member } from "../../../views/right_panel/UserInfo";
import { useUserTimezone } from "../../../../hooks/useUserTimezone";
import UserIdentifierCustomisations from "../../../../customisations/UserIdentifier";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import { verifyUser } from "../../../../verification";

export interface PresenceInfo {
    lastActiveAgo: number | undefined;
    currentlyActive: boolean | undefined;
    state: string | undefined;
}

export interface TimezoneInfo {
    timezone: string;
    friendly: string;
}

export interface UserInfoHeaderState {
    onMemberAvatarClick: () => void;
    precenseInfo: PresenceInfo;
    showPresence: boolean;
    timezoneInfo: TimezoneInfo | null;
    userIdentifier: string | null;
}

export interface UserfoHeaderProps {
    member: Member;
    devices: IDevice[];
    roomId?: string;
    hideVerificationSection?: boolean;
}

export interface UserInfoVerificationSectionState {
    canVerify: boolean;
    hasCrossSigningKeys: boolean | undefined;
    isUserVerified: boolean;
    verifySelectedUser: Promise<void>;
}

export function useUserfoHeaderViewModel({
    member,
    devices,
    roomId,
    hideVerificationSection,
}: UserfoHeaderProps): UserInfoHeaderState {
    const cli = useContext(MatrixClientContext);

    let showPresence = true;

    const precenseInfo: PresenceInfo = {
        lastActiveAgo: undefined,
        currentlyActive: undefined,
        state: undefined,
    };

    const enablePresenceByHsUrl = SdkConfig.get("enable_presence_by_hs_url");

    const timezoneInfo = useUserTimezone(cli, member.userId);

    const userIdentifier = UserIdentifierCustomisations.getDisplayUserIdentifier?.(member.userId, {
        roomId,
        withDisplayName: true,
    });

    const onMemberAvatarClick = useCallback(() => {
        const avatarUrl = (member as RoomMember).getMxcAvatarUrl
            ? (member as RoomMember).getMxcAvatarUrl()
            : (member as User).avatarUrl;

        const httpUrl = mediaFromMxc(avatarUrl).srcHttp;
        if (!httpUrl) return;

        const params = {
            src: httpUrl,
            name: (member as RoomMember).name || (member as User).displayName,
        };

        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    }, [member]);

    if (member instanceof RoomMember && member.user) {
        precenseInfo.state = member.user.presence;
        precenseInfo.lastActiveAgo = member.user.lastActiveAgo;
        precenseInfo.currentlyActive = member.user.currentlyActive;
    }

    if (enablePresenceByHsUrl && enablePresenceByHsUrl[cli.baseUrl] !== undefined) {
        showPresence = enablePresenceByHsUrl[cli.baseUrl];
    }

    return {
        onMemberAvatarClick,
        showPresence,
        precenseInfo,
        timezoneInfo,
        userIdentifier,
    };
}

const useHomeserverSupportsCrossSigning = (cli: MatrixClient): boolean => {
    return useAsyncMemo<boolean>(
        async () => {
            return cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing");
        },
        [cli],
        false,
    );
};

const useHasCrossSigningKeys = (cli: MatrixClient, member: User, canVerify: boolean): boolean | undefined => {
    return useAsyncMemo(async () => {
        if (!canVerify) return undefined;
        return await cli.getCrypto()?.userHasCrossSigningKeys(member.userId, true);
    }, [cli, member, canVerify]);
};

export const useUserInfoVerificationSection = (
    member: User | RoomMember,
    devices: IDevice[],
): UserInfoVerificationSectionState => {
    const cli = useContext(MatrixClientContext);

    const homeserverSupportsCrossSigning = useHomeserverSupportsCrossSigning(cli);

    const userTrust = useAsyncMemo<UserVerificationStatus | undefined>(
        async () => cli.getCrypto()?.getUserVerificationStatus(member.userId),
        [member.userId],
        // the user verification status is not initialized
        undefined,
    );
    const hasUserVerificationStatus = Boolean(userTrust);
    const isUserVerified = Boolean(userTrust?.isVerified());
    const isMe = member.userId === cli.getUserId();
    const canVerify =
        hasUserVerificationStatus &&
        homeserverSupportsCrossSigning &&
        !isUserVerified &&
        !isMe &&
        devices &&
        devices.length > 0;

    const hasCrossSigningKeys = useHasCrossSigningKeys(cli, member as User, canVerify);
    const verifySelectedUser = verifyUser(cli, member as User);

    return {
        canVerify,
        hasCrossSigningKeys,
        isUserVerified,
        verifySelectedUser,
    };
};
