/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useMemo, useState } from "react";
import { RoomStateEvent, type MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { type UserVerificationStatus, CryptoEvent } from "matrix-js-sdk/src/crypto-api";

import dis from "../../../../dispatcher/dispatcher";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { Action } from "../../../../dispatcher/actions";
import { asyncSome } from "../../../../utils/arrays";
import { getUserDeviceIds } from "../../../../utils/crypto/deviceInfo";
import { type RoomMember } from "../../../../models/rooms/RoomMember";
import { _t, _td, type TranslationKey } from "../../../../languageHandler";
import UserIdentifierCustomisations from "../../../../customisations/UserIdentifier";
import { E2EStatus } from "../../../../utils/ShieldUtils";

interface MemberTileViewModelProps {
    member: RoomMember;
    showPresence?: boolean;
}

export interface MemberTileViewState extends MemberTileViewModelProps {
    e2eStatus?: E2EStatus;
    name: string;
    onClick: () => void;
    title?: string;
    userLabel?: string;
}

export enum PowerStatus {
    Admin = "admin",
    Moderator = "moderator",
}

const PowerLabel: Record<PowerStatus, TranslationKey> = {
    [PowerStatus.Admin]: _td("power_level|admin"),
    [PowerStatus.Moderator]: _td("power_level|moderator"),
};

export function useMemberTileViewModel(props: MemberTileViewModelProps): MemberTileViewState {
    const [e2eStatus, setE2eStatus] = useState<E2EStatus | undefined>();

    useEffect(() => {
        const cli = MatrixClientPeg.safeGet();

        const updateE2EStatus = async (): Promise<void> => {
            const { userId } = props.member;
            const isMe = userId === cli.getUserId();
            const userTrust = await cli.getCrypto()?.getUserVerificationStatus(userId);
            if (!userTrust?.isCrossSigningVerified()) {
                setE2eStatus(userTrust?.wasCrossSigningVerified() ? E2EStatus.Warning : E2EStatus.Normal);
                return;
            }

            const deviceIDs = await getUserDeviceIds(cli, userId);
            const anyDeviceUnverified = await asyncSome(deviceIDs, async (deviceId) => {
                // For your own devices, we use the stricter check of cross-signing
                // verification to encourage everyone to trust their own devices via
                // cross-signing so that other users can then safely trust you.
                // For other people's devices, the more general verified check that
                // includes locally verified devices can be used.
                const deviceTrust = await cli.getCrypto()?.getDeviceVerificationStatus(userId, deviceId);
                return !deviceTrust || (isMe ? !deviceTrust.crossSigningVerified : !deviceTrust.isVerified());
            });
            setE2eStatus(anyDeviceUnverified ? E2EStatus.Warning : E2EStatus.Verified);
        };

        const onRoomStateEvents = (ev: MatrixEvent): void => {
            if (ev.getType() !== EventType.RoomEncryption) return;
            const { roomId } = props.member;
            if (ev.getRoomId() !== roomId) return;

            // The room is encrypted now.
            cli.removeListener(RoomStateEvent.Events, onRoomStateEvents);
            updateE2EStatus();
        };

        const onUserTrustStatusChanged = (userId: string, trustStatus: UserVerificationStatus): void => {
            if (userId !== props.member.userId) return;
            updateE2EStatus();
        };

        const { roomId } = props.member;
        if (roomId) {
            const isRoomEncrypted = cli.isRoomEncrypted(roomId);
            if (isRoomEncrypted) {
                cli.on(CryptoEvent.UserTrustStatusChanged, onUserTrustStatusChanged);
                updateE2EStatus();
            } else {
                // Listen for room to become encrypted
                cli.on(RoomStateEvent.Events, onRoomStateEvents);
            }
        }

        return () => {
            if (cli) {
                cli.removeListener(RoomStateEvent.Events, onRoomStateEvents);
                cli.removeListener(CryptoEvent.UserTrustStatusChanged, onUserTrustStatusChanged);
            }
        };
    }, [props.member]);

    const onClick = (): void => {
        dis.dispatch({
            action: Action.ViewUser,
            member: props.member,
            push: true,
        });
    };

    const member = props.member;
    const name = props.member.name;

    const powerStatusMap = new Map([
        [100, PowerStatus.Admin],
        [50, PowerStatus.Moderator],
    ]);

    // Find the nearest power level with a badge
    let powerLevel = props.member.powerLevel;
    for (const [pl] of powerStatusMap) {
        if (props.member.powerLevel >= pl) {
            powerLevel = pl;
            break;
        }
    }

    const title = useMemo(() => {
        return _t("member_list|power_label", {
            userName: UserIdentifierCustomisations.getDisplayUserIdentifier(member.userId, {
                roomId: member.roomId,
            }),
            powerLevelNumber: member.powerLevel,
        }).trim();
    }, [member.powerLevel, member.roomId, member.userId]);

    let userLabel;
    const powerStatus = powerStatusMap.get(powerLevel);
    if (powerStatus) {
        userLabel = _t(PowerLabel[powerStatus]);
    }
    if (props.member.isInvite) {
        userLabel = _t("member_list|invited_label");
    }

    return {
        title,
        member,
        name,
        onClick,
        e2eStatus,
        showPresence: props.showPresence,
        userLabel,
    };
}
