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
import {
    type MatrixClient,
    RoomMember,
    type Room,
    type User,
    type Device,
    MatrixEvent,
    EventType,
} from "matrix-js-sdk/src/matrix";
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
import PosthogTrackers from "../../../PosthogTrackers";
import { UserInfoHeaderView } from "./user_info/UserInfoHeaderView";
import { UserInfoBasicView } from "./user_info/UserInfoBasicView";
import { SDKContext } from "../../../contexts/SDKContext.ts";

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
    users_default?: number;
    events_default?: number;
    state_default?: number;
    ban?: number;
    kick?: number;
    redact?: number;
}

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
        void downloadDeviceList();

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
            void updateDevices();
        };
        const onUserTrustStatusChanged = (_userId: string, trustLevel: UserVerificationStatus): void => {
            if (_userId !== userId) return;
            void updateDevices();
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

/**
 * Fetch the profile of a member we were handed nothing but an ID for.
 *
 * The panel is usually opened from a room's member list, where the member already carries a display
 * name and an avatar. It can also be opened by following a link to a user who is not in the room, and
 * then all that is known about them is their ID, which leaves the header with nothing to render. The
 * fetched profile is shaped into a RoomMember because that is the API the views below read it
 * through. No membership is put on it, so nothing beyond the name and the avatar changes.
 *
 * @param member - The member the panel was opened for.
 * @returns The member to render: the one that was passed in, or a profile-backed stand-in for it.
 */
const useMemberProfile = (member: Member): Member => {
    const { userProfilesStore } = useContext(SDKContext);
    const [profileMember, setProfileMember] = useState<RoomMember>();

    // Anyone who came out of a room's state arrives with their profile already on them. A User does
    // not: it is constructed from an ID alone and only filled in by a presence event, so it can be
    // carrying nothing but the ID it was named after.
    const needsProfile = !(member instanceof RoomMember) && (!member.avatarUrl || member.displayName === member.userId);
    const { userId } = member;

    useEffect(() => {
        if (!needsProfile) return;

        let cancelled = false;
        userProfilesStore.getOrFetchProfile(userId).then((profile) => {
            if (cancelled || !profile) return;

            const memberWithProfile = new RoomMember("", userId);
            memberWithProfile.setMembershipEvent(new MatrixEvent({ type: EventType.RoomMember, content: profile }));
            setProfileMember(memberWithProfile);
        });

        return () => {
            cancelled = true;
        };
    }, [needsProfile, userId, userProfilesStore]);

    // The panel can be pointed at somebody else while a fetch is still in flight, so only a profile
    // belonging to the member being rendered is used.
    if (needsProfile && profileMember && profileMember.userId === userId) return profileMember;
    return member;
};

interface IProps {
    user: Member;
    room?: Room;
    phase: RightPanelPhases.MemberInfo | RightPanelPhases.EncryptionPanel;
    onClose(this: void): void;
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
}

const UserInfo: React.FC<IProps> = ({ user, room, onClose, phase = RightPanelPhases.MemberInfo, ...props }) => {
    const sdkContext = useContext(SDKContext);

    // fetch latest room member if we have a room, so we don't show historical information, falling back to user
    const roomMember = useMemo(() => (room ? room.getMember(user.userId) || user : user), [room, user]);
    const member = useMemberProfile(roomMember);

    const isRoomEncrypted = useIsEncrypted(sdkContext.client!, room);
    const devices = useDevices(user.userId) ?? [];

    const classes = ["mx_UserInfo"];

    const onEncryptionPanelClose = (): void => {
        sdkContext.rightPanelStore.popCard();
    };

    let content: JSX.Element | undefined;
    switch (phase) {
        case RightPanelPhases.MemberInfo:
            content = <UserInfoBasicView room={room!} member={member} />;
            break;
        case RightPanelPhases.EncryptionPanel:
            classes.push("mx_UserInfo_smallAvatar");
            content = (
                <EncryptionPanel
                    {...(props as React.ComponentProps<typeof EncryptionPanel>)}
                    member={member}
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
        <UserInfoHeaderView
            hideVerificationSection={phase === RightPanelPhases.EncryptionPanel}
            member={member}
            devices={devices}
            roomId={room?.roomId}
        />
    );

    return (
        <BaseCard
            className={classes.join(" ")}
            header={_t("common|profile")}
            onClose={onClose}
            closeLabel={closeLabel}
            onBack={(ev: ButtonEvent) => {
                if (sdkContext.rightPanelStore.previousCard.phase === RightPanelPhases.MemberList) {
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
