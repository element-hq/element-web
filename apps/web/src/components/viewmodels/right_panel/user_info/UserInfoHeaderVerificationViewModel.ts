/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { useContext } from "react";
import { type UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import { type IDevice } from "../../../views/right_panel/UserInfo";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import { verifyUser } from "../../../../verification";
import { SDKContext } from "../../../../contexts/SDKContext.ts";

export interface UserInfoVerificationSectionState {
    /**
     * variables used to check if we can verify the user and display the verify button
     */
    canVerify: boolean;
    hasCrossSigningKeys: boolean | undefined;
    /**
     * true while the verification status, the devices or the cross-signing keys are still being fetched
     */
    isLoading: boolean;
    /**
     * used to display correct badge value
     */
    isUserVerified: boolean;
    /**
     * callback function when verifyUser button is clicked
     */
    verifySelectedUser: () => void;
}

const useHasCrossSigningKeys = (cli: MatrixClient, member: User, canVerify: boolean): boolean | undefined => {
    return useAsyncMemo(async () => {
        if (!canVerify) return undefined;
        return cli.getCrypto()?.userHasCrossSigningKeys(member.userId, true);
    }, [cli, member, canVerify]);
};

/**
 * View model for the userInfoVerificationHeaderView
 * @param member - the user whose profile is shown
 * @param devices - the user's devices, or undefined while they are still being fetched
 * @see {@link UserInfoVerificationSectionState} for more information about what this view model returns.
 */
export const useUserInfoVerificationViewModel = (
    member: User | RoomMember,
    devices: IDevice[] | undefined,
): UserInfoVerificationSectionState => {
    const sdkContext = useContext(SDKContext);

    const userTrust = useAsyncMemo<UserVerificationStatus | undefined>(
        async () => sdkContext.client?.getCrypto()?.getUserVerificationStatus(member.userId),
        [member.userId],
        // the user verification status is not initialized
        undefined,
    );
    const hasUserVerificationStatus = Boolean(userTrust);
    const isUserVerified = Boolean(userTrust?.isVerified());
    const isMe = member.userId === sdkContext.client!.getUserId();
    const canVerify = hasUserVerificationStatus && !isUserVerified && !isMe && !!devices?.length;

    const hasCrossSigningKeys = useHasCrossSigningKeys(sdkContext.client!, member as User, canVerify);
    // the cross-signing keys are only fetched for a user we can verify
    const isLoading =
        !hasUserVerificationStatus || devices === undefined || (canVerify && hasCrossSigningKeys === undefined);
    const verifySelectedUser = (): void => verifyUser(sdkContext.rightPanelStore, sdkContext.client!, member as User);

    return {
        canVerify,
        hasCrossSigningKeys,
        isLoading,
        isUserVerified,
        verifySelectedUser,
    };
};
