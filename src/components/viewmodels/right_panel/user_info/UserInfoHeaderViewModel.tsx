/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { useCallback, useContext } from "react";

import { mediaFromMxc } from "../../../../customisations/Media";
import Modal from "../../../../Modal";
import ImageView from "../../../views/elements/ImageView";
import SdkConfig from "../../../../SdkConfig";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { type Member } from "../../../views/right_panel/UserInfo";
import { useUserTimezone } from "../../../../hooks/useUserTimezone";
import UserIdentifierCustomisations from "../../../../customisations/UserIdentifier";

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

export interface UserInfoVerificationSectionState {
    canVerify: boolean;
    hasCrossSigningKeys: boolean | undefined;
    isUserVerified: boolean;
    verifySelectedUser: Promise<void>;
}

interface UserInfoHeaderViewModelProps {
    member: Member;
    roomId?: string;
}

export function useUserfoHeaderViewModel({ member, roomId }: UserInfoHeaderViewModelProps): UserInfoHeaderState {
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
