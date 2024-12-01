/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { useEffect, useMemo, useState } from "react";
import { RoomStateEvent, MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { DeviceInfo } from "matrix-js-sdk/src/crypto/deviceinfo";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";

import dis from "../../dispatcher/dispatcher";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { Action } from "../../dispatcher/actions";
import { asyncSome } from "../../utils/arrays";
import { getUserDeviceIds } from "../../utils/crypto/deviceInfo";
import { RoomMember } from "../../models/rooms/RoomMember";
import { E2EState } from "../views/rooms/E2EIcon";
import { _t, _td, TranslationKey } from "../../languageHandler";
import UserIdentifierCustomisations from "../../customisations/UserIdentifier";

interface IProps {
    member: RoomMember;
    showPresence?: boolean;
}

export interface MemberTileViewState extends IProps {
    e2eStatus?: E2EState;
    name: string;
    onClick: () => void;
    title: string;
    userLabel?: string;
}

export enum PowerStatus {
    Admin = "admin",
    Moderator = "moderator",
}

const PowerLabel: Record<PowerStatus, TranslationKey> = {
    [PowerStatus.Admin]: _td("power_level|admin"),
    [PowerStatus.Moderator]: _td("power_level|mod"),
};

export default function useMemberTileViewModel(props: IProps): MemberTileViewState {
    const [e2eStatus, setE2eStatus] = useState<E2EState | undefined>();

    useEffect(() => {
        const cli = MatrixClientPeg.safeGet();

        const updateE2EStatus = async (): Promise<void> => {
            const { userId } = props.member;
            const isMe = userId === cli.getUserId();
            const userTrust = await cli.getCrypto()?.getUserVerificationStatus(userId);
            if (!userTrust?.isCrossSigningVerified()) {
                setE2eStatus(userTrust?.wasCrossSigningVerified() ? E2EState.Warning : E2EState.Normal);
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
            setE2eStatus(anyDeviceUnverified ? E2EState.Warning : E2EState.Verified);
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

        const onDeviceVerificationChanged = (userId: string, deviceId: string, deviceInfo: DeviceInfo): void => {
            if (userId !== props.member.userId) return;
            updateE2EStatus();
        };

        const { roomId } = props.member;
        if (roomId) {
            const isRoomEncrypted = cli.isRoomEncrypted(roomId);
            if (isRoomEncrypted) {
                cli.on(CryptoEvent.UserTrustStatusChanged, onUserTrustStatusChanged);
                cli.on(CryptoEvent.DeviceVerificationChanged, onDeviceVerificationChanged);
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
                cli.removeListener(CryptoEvent.DeviceVerificationChanged, onDeviceVerificationChanged);
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
        userLabel = "(Invited)";
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
