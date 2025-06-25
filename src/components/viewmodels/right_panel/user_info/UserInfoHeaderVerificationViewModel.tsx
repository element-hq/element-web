/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type RoomMember, type User } from "matrix-js-sdk/src/matrix";
import { useContext } from "react";
import { type UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { type IDevice } from "../../../views/right_panel/UserInfo";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import { verifyUser } from "../../../../verification";
import { type UserInfoVerificationSectionState } from "./UserInfoHeaderViewModel";


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
