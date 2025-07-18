/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import { type MatrixClient, RoomMember, type Room, type User, type Device } from "matrix-js-sdk/src/matrix";
import { type UserVerificationStatus, type VerificationRequest, CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { Badge, Button, Heading, InlineSpinner, Text, Tooltip } from "@vector-im/compound-web";
import VerifiedIcon from "@vector-im/compound-design-tokens/assets/web/icons/verified";

import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import { type ButtonEvent } from "../elements/AccessibleButton";
import SdkConfig from "../../../SdkConfig";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import EncryptionPanel from "./EncryptionPanel";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import { verifyUser } from "../../../verification";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted";
import BaseCard from "./BaseCard";
import ImageView from "../elements/ImageView";
import MemberAvatar from "../avatars/MemberAvatar";
import PresenceLabel from "../rooms/PresenceLabel";
import QuestionDialog from "../dialogs/QuestionDialog";
import { mediaFromMxc } from "../../../customisations/Media";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { type IRightPanelCardState } from "../../../stores/right-panel/RightPanelStoreIPanelState";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import PosthogTrackers from "../../../PosthogTrackers";
import { Flex } from "../../utils/Flex";
import CopyableText from "../elements/CopyableText";
import { useUserTimezone } from "../../../hooks/useUserTimezone";
import { UserInfoBasic } from "./user_info/UserInfoBasic";

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

const useHomeserverSupportsCrossSigning = (cli: MatrixClient): boolean => {
    return useAsyncMemo<boolean>(
        async () => {
            return cli.doesServerSupportUnstableFeature("org.matrix.e2e_cross_signing");
        },
        [cli],
        false,
    );
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

function useHasCrossSigningKeys(cli: MatrixClient, member: User, canVerify: boolean): boolean | undefined {
    return useAsyncMemo(async () => {
        if (!canVerify) return undefined;
        return await cli.getCrypto()?.userHasCrossSigningKeys(member.userId, true);
    }, [cli, member, canVerify]);
}

const VerificationSection: React.FC<{
    member: User | RoomMember;
    devices: IDevice[];
}> = ({ member, devices }) => {
    const cli = useContext(MatrixClientContext);
    let content;
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

    if (isUserVerified) {
        content = (
            <Badge kind="green" className="mx_UserInfo_verified_badge">
                <VerifiedIcon className="mx_UserInfo_verified_icon" height="16px" width="16px" />
                <Text size="sm" weight="medium" className="mx_UserInfo_verified_label">
                    {_t("common|verified")}
                </Text>
            </Badge>
        );
    } else if (hasCrossSigningKeys === undefined) {
        // We are still fetching the cross-signing keys for the user, show spinner.
        content = <InlineSpinner size={24} />;
    } else if (canVerify && hasCrossSigningKeys) {
        content = (
            <div className="mx_UserInfo_container_verifyButton">
                <Button
                    className="mx_UserInfo_verify_button"
                    kind="tertiary"
                    size="sm"
                    onClick={() => verifyUser(cli, member as User)}
                >
                    {_t("user_info|verify_button")}
                </Button>
            </div>
        );
    } else {
        content = (
            <Text className="mx_UserInfo_verification_unavailable" size="sm">
                ({_t("user_info|verification_unavailable")})
            </Text>
        );
    }

    return (
        <Flex justify="center" align="center" className="mx_UserInfo_verification">
            {content}
        </Flex>
    );
};

export type Member = User | RoomMember;

export const UserInfoHeader: React.FC<{
    member: Member;
    devices: IDevice[];
    roomId?: string;
    hideVerificationSection?: boolean;
}> = ({ member, devices, roomId, hideVerificationSection }) => {
    const cli = useContext(MatrixClientContext);

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

    const avatarUrl = (member as User).avatarUrl;

    let presenceState: string | undefined;
    let presenceLastActiveAgo: number | undefined;
    let presenceCurrentlyActive: boolean | undefined;
    if (member instanceof RoomMember && member.user) {
        presenceState = member.user.presence;
        presenceLastActiveAgo = member.user.lastActiveAgo;
        presenceCurrentlyActive = member.user.currentlyActive;
    }

    const enablePresenceByHsUrl = SdkConfig.get("enable_presence_by_hs_url");
    let showPresence = true;
    if (enablePresenceByHsUrl && enablePresenceByHsUrl[cli.baseUrl] !== undefined) {
        showPresence = enablePresenceByHsUrl[cli.baseUrl];
    }

    let presenceLabel: JSX.Element | undefined;
    if (showPresence) {
        presenceLabel = (
            <PresenceLabel
                activeAgo={presenceLastActiveAgo}
                currentlyActive={presenceCurrentlyActive}
                presenceState={presenceState}
                className="mx_UserInfo_profileStatus"
                coloured
            />
        );
    }

    const timezoneInfo = useUserTimezone(cli, member.userId);

    const userIdentifier = UserIdentifierCustomisations.getDisplayUserIdentifier?.(member.userId, {
        roomId,
        withDisplayName: true,
    });
    const displayName = (member as RoomMember).rawDisplayName;
    return (
        <React.Fragment>
            <div className="mx_UserInfo_avatar">
                <div className="mx_UserInfo_avatar_transition">
                    <div className="mx_UserInfo_avatar_transition_child">
                        <MemberAvatar
                            key={member.userId} // to instantly blank the avatar when UserInfo changes members
                            member={member as RoomMember}
                            size="120px"
                            resizeMethod="scale"
                            fallbackUserId={member.userId}
                            onClick={onMemberAvatarClick}
                            urls={avatarUrl ? [avatarUrl] : undefined}
                        />
                    </div>
                </div>
            </div>

            <Container className="mx_UserInfo_header">
                <Flex direction="column" align="center" className="mx_UserInfo_profile">
                    <Heading size="sm" weight="semibold" as="h1" dir="auto">
                        <Flex className="mx_UserInfo_profile_name" direction="row-reverse" align="center">
                            {displayName}
                        </Flex>
                    </Heading>
                    {presenceLabel}
                    {timezoneInfo && (
                        <Tooltip label={timezoneInfo?.timezone ?? ""}>
                            <Flex align="center" className="mx_UserInfo_timezone">
                                <Text size="sm" weight="regular">
                                    {timezoneInfo?.friendly ?? ""}
                                </Text>
                            </Flex>
                        </Tooltip>
                    )}
                    <Text size="sm" weight="semibold" className="mx_UserInfo_profile_mxid">
                        <CopyableText getTextToCopy={() => userIdentifier} border={false}>
                            {userIdentifier}
                        </CopyableText>
                    </Text>
                </Flex>
                {!hideVerificationSection && <VerificationSection member={member} devices={devices} />}
            </Container>
        </React.Fragment>
    );
};

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
            content = <UserInfoBasic room={room as Room} member={member as User} />;
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
            <UserInfoHeader
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
