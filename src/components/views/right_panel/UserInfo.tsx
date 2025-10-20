/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import { type MatrixClient, type RoomMember, type Room, type User, type Device } from "matrix-js-sdk/src/matrix";
import { type UserVerificationStatus, type VerificationRequest, CryptoEvent } from "matrix-js-sdk/src/crypto-api";

import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import { type ButtonEvent } from "../elements/AccessibleButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import EncryptionPanel from "./EncryptionPanel";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted";
import BaseCard from "./BaseCard";
import QuestionDialog from "../dialogs/QuestionDialog";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { type IRightPanelCardState } from "../../../stores/right-panel/RightPanelStoreIPanelState";
import PosthogTrackers from "../../../PosthogTrackers";
import { UserInfoHeaderView } from "./user_info/UserInfoHeaderView";
import { UserInfoBasicView } from "./user_info/UserInfoBasicView";

export interface IDevice extends Device {
    ambiguous?: boolean;
}

export const disambiguateDevices = (devices: IDevice[]): void => {
    const names = Object.create(null);
    for (let i = 0; i < devices.length; i++) {
        const name = devices[i].displayName ?? "";
        const indexList = names[name] || [];
        indexList.push(i);
        names[name] = indexList;
    }
    for (const name in names) {
        if (names[name].length > 1) {
            names[name].forEach((j: number) => {
                devices[j].ambiguous = true;
            });
        }
    }
};

export const warnSelfDemote = async (isSpace: boolean): Promise<boolean> => {
    const { finished } = Modal.createDialog(QuestionDialog, {
        title: _t("user_info|demote_self_confirm_title"),
        description: (
            <div>
                {isSpace
                    ? _t("user_info|demote_self_confirm_description_space")
                    : _t("user_info|demote_self_confirm_room")}
            </div>
        ),
        button: _t("user_info|demote_button"),
    });

    const [confirmed] = await finished;
    return !!confirmed;
};

export const Container: React.FC<{
    children: ReactNode;
    className?: string;
}> = ({ children, className }) => {
    const classes = classNames("mx_UserInfo_container", className);
    return <div className={classes}>{children}</div>;
};

export interface IPowerLevelsContent {
    events?: Record<string, number>;
    // eslint-disable-next-line camelcase
    users_default?: number;
    // eslint-disable-next-line camelcase
    events_default?: number;
    // eslint-disable-next-line camelcase
    state_default?: number;
    ban?: number;
    kick?: number;
    redact?: number;
}

export const isMuted = (member: RoomMember, powerLevelContent: IPowerLevelsContent): boolean => {
    if (!powerLevelContent || !member) return false;

    const levelToSend =
        (powerLevelContent.events ? powerLevelContent.events["m.room.message"] : null) ||
        powerLevelContent.events_default;

    // levelToSend could be undefined as .events_default is optional. Coercing in this case using
    // Number() would always return false, so this preserves behaviour
    // FIXME: per the spec, if `events_default` is unset, it defaults to zero. If
    //   the member has a negative powerlevel, this will give an incorrect result.
    if (levelToSend === undefined) return false;

    return member.powerLevel < levelToSend;
};

export interface IRoomPermissions {
    modifyLevelMax: number;
    canEdit: boolean;
    canInvite: boolean;
}

async function getUserDeviceInfo(
    userId: string,
    cli: MatrixClient,
    downloadUncached = false,
): Promise<Device[] | undefined> {
    const userDeviceMap = await cli.getCrypto()?.getUserDeviceInfo([userId], downloadUncached);
    const devicesMap = userDeviceMap?.get(userId);

    if (!devicesMap) return;

    return Array.from(devicesMap.values());
}

export const useDevices = (userId: string): IDevice[] | undefined | null => {
    const cli = useContext(MatrixClientContext);

    // undefined means yet to be loaded, null means failed to load, otherwise list of devices
    const [devices, setDevices] = useState<undefined | null | IDevice[]>(undefined);
    // Download device lists
    useEffect(() => {
        setDevices(undefined);

        let cancelled = false;

        async function downloadDeviceList(): Promise<void> {
            try {
                const devices = await getUserDeviceInfo(userId, cli, true);

                if (cancelled || !devices) {
                    // we got cancelled - presumably a different user now
                    return;
                }

                disambiguateDevices(devices);
                setDevices(devices);
            } catch {
                setDevices(null);
            }
        }
        downloadDeviceList();

        // Handle being unmounted
        return () => {
            cancelled = true;
        };
    }, [cli, userId]);

    // Listen to changes
    useEffect(() => {
        let cancel = false;
        const updateDevices = async (): Promise<void> => {
            const newDevices = await getUserDeviceInfo(userId, cli);
            if (cancel || !newDevices) return;
            setDevices(newDevices);
        };
        const onDevicesUpdated = (users: string[]): void => {
            if (!users.includes(userId)) return;
            updateDevices();
        };
        const onUserTrustStatusChanged = (_userId: string, trustLevel: UserVerificationStatus): void => {
            if (_userId !== userId) return;
            updateDevices();
        };
        cli.on(CryptoEvent.DevicesUpdated, onDevicesUpdated);
        cli.on(CryptoEvent.UserTrustStatusChanged, onUserTrustStatusChanged);
        // Handle being unmounted
        return () => {
            cancel = true;
            cli.removeListener(CryptoEvent.DevicesUpdated, onDevicesUpdated);
            cli.removeListener(CryptoEvent.UserTrustStatusChanged, onUserTrustStatusChanged);
        };
    }, [cli, userId]);

    return devices;
};

export type Member = User | RoomMember;

interface IProps {
    user: Member;
    room?: Room;
    phase: RightPanelPhases.MemberInfo | RightPanelPhases.EncryptionPanel;
    onClose(): void;
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
}

const UserInfo: React.FC<IProps> = ({ user, room, onClose, phase = RightPanelPhases.MemberInfo, ...props }) => {
    const cli = useContext(MatrixClientContext);

    // fetch latest room member if we have a room, so we don't show historical information, falling back to user
    const member = useMemo(() => (room ? room.getMember(user.userId) || user : user), [room, user]);

    const isRoomEncrypted = useIsEncrypted(cli, room);
    const devices = useDevices(user.userId) ?? [];

    const classes = ["mx_UserInfo"];

    let cardState: IRightPanelCardState = {};
    // We have no previousPhase for when viewing a UserInfo without a Room at this time
    if (room && phase === RightPanelPhases.EncryptionPanel) {
        cardState = { member };
    }

    const onEncryptionPanelClose = (): void => {
        RightPanelStore.instance.popCard();
    };

    let content: JSX.Element | undefined;
    switch (phase) {
        case RightPanelPhases.MemberInfo:
            content = <UserInfoBasicView room={room as Room} member={member as User} />;
            break;
        case RightPanelPhases.EncryptionPanel:
            classes.push("mx_UserInfo_smallAvatar");
            content = (
                <EncryptionPanel
                    {...(props as React.ComponentProps<typeof EncryptionPanel>)}
                    member={member as User | RoomMember}
                    onClose={onEncryptionPanelClose}
                    isRoomEncrypted={Boolean(isRoomEncrypted)}
                />
            );
            break;
    }

    let closeLabel: string | undefined;
    if (phase === RightPanelPhases.EncryptionPanel) {
        const verificationRequest = (props as React.ComponentProps<typeof EncryptionPanel>).verificationRequest;
        if (verificationRequest && verificationRequest.pending) {
            closeLabel = _t("action|cancel");
        }
    }

    const header = (
        <>
            <UserInfoHeaderView
                hideVerificationSection={phase === RightPanelPhases.EncryptionPanel}
                member={member}
                devices={devices}
                roomId={room?.roomId}
            />
        </>
    );

    return (
        <BaseCard
            className={classes.join(" ")}
            header={_t("common|profile")}
            onClose={onClose}
            closeLabel={closeLabel}
            cardState={cardState}
            onBack={(ev: ButtonEvent) => {
                if (RightPanelStore.instance.previousCard.phase === RightPanelPhases.MemberList) {
                    PosthogTrackers.trackInteraction("WebRightPanelRoomUserInfoBackButton", ev);
                }
            }}
        >
            {header}
            {content}
        </BaseCard>
    );
};

export default UserInfo;
