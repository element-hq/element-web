/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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

import React, { ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import { ClientEvent, MatrixClient } from "matrix-js-sdk/src/client";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { User } from "matrix-js-sdk/src/models/user";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { logger } from "matrix-js-sdk/src/logger";
import { CryptoEvent } from "matrix-js-sdk/src/crypto";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { UserTrustLevel } from "matrix-js-sdk/src/crypto/CrossSigning";
import { Device } from "matrix-js-sdk/src/models/device";

import dis from "../../../dispatcher/dispatcher";
import Modal from "../../../Modal";
import { _t, UserFriendlyError } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import SdkConfig from "../../../SdkConfig";
import MultiInviter from "../../../utils/MultiInviter";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import E2EIcon from "../rooms/E2EIcon";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { textualPowerLevel } from "../../../Roles";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import EncryptionPanel from "./EncryptionPanel";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import { legacyVerifyUser, verifyDevice, verifyUser } from "../../../verification";
import { Action } from "../../../dispatcher/actions";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted";
import BaseCard from "./BaseCard";
import { E2EStatus } from "../../../utils/ShieldUtils";
import ImageView from "../elements/ImageView";
import Spinner from "../elements/Spinner";
import PowerSelector from "../elements/PowerSelector";
import MemberAvatar from "../avatars/MemberAvatar";
import PresenceLabel from "../rooms/PresenceLabel";
import BulkRedactDialog from "../dialogs/BulkRedactDialog";
import ShareDialog from "../dialogs/ShareDialog";
import ErrorDialog from "../dialogs/ErrorDialog";
import QuestionDialog from "../dialogs/QuestionDialog";
import ConfirmUserActionDialog from "../dialogs/ConfirmUserActionDialog";
import RoomAvatar from "../avatars/RoomAvatar";
import RoomName from "../elements/RoomName";
import { mediaFromMxc } from "../../../customisations/Media";
import UIStore from "../../../stores/UIStore";
import { ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import ConfirmSpaceUserActionDialog from "../dialogs/ConfirmSpaceUserActionDialog";
import { bulkSpaceBehaviour } from "../../../utils/space";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { TimelineRenderingType } from "../../../contexts/RoomContext";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { IRightPanelCardState } from "../../../stores/right-panel/RightPanelStoreIPanelState";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import PosthogTrackers from "../../../PosthogTrackers";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { DirectoryMember, startDmOnFirstMessage } from "../../../utils/direct-messages";
import { SdkContextClass } from "../../../contexts/SDKContext";
import { asyncSome } from "../../../utils/arrays";

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

export const getE2EStatus = async (cli: MatrixClient, userId: string, devices: IDevice[]): Promise<E2EStatus> => {
    const isMe = userId === cli.getUserId();
    const userTrust = cli.checkUserTrust(userId);
    if (!userTrust.isCrossSigningVerified()) {
        return userTrust.wasCrossSigningVerified() ? E2EStatus.Warning : E2EStatus.Normal;
    }

    const anyDeviceUnverified = await asyncSome(devices, async (device) => {
        const { deviceId } = device;
        // For your own devices, we use the stricter check of cross-signing
        // verification to encourage everyone to trust their own devices via
        // cross-signing so that other users can then safely trust you.
        // For other people's devices, the more general verified check that
        // includes locally verified devices can be used.
        const deviceTrust = await cli.getCrypto()?.getDeviceVerificationStatus(userId, deviceId);
        return isMe ? !deviceTrust?.crossSigningVerified : !deviceTrust?.isVerified();
    });
    return anyDeviceUnverified ? E2EStatus.Warning : E2EStatus.Verified;
};

/**
 * Converts the member to a DirectoryMember and starts a DM with them.
 */
async function openDmForUser(matrixClient: MatrixClient, user: Member): Promise<void> {
    const avatarUrl = user instanceof User ? user.avatarUrl : user.getMxcAvatarUrl();
    const startDmUser = new DirectoryMember({
        user_id: user.userId,
        display_name: user.rawDisplayName,
        avatar_url: avatarUrl,
    });
    await startDmOnFirstMessage(matrixClient, [startDmUser]);
}

type SetUpdating = (updating: boolean) => void;

function useHasCrossSigningKeys(
    cli: MatrixClient,
    member: User,
    canVerify: boolean,
    setUpdating: SetUpdating,
): boolean | undefined {
    return useAsyncMemo(async () => {
        if (!canVerify) {
            return undefined;
        }
        setUpdating(true);
        try {
            // We call it to populate the user keys and devices
            await cli.getCrypto()?.getUserDeviceInfo([member.userId], true);
            const xsi = cli.getStoredCrossSigningForUser(member.userId);
            const key = xsi && xsi.getId();
            return !!key;
        } finally {
            setUpdating(false);
        }
    }, [cli, member, canVerify]);
}

export function DeviceItem({ userId, device }: { userId: string; device: IDevice }): JSX.Element {
    const cli = useContext(MatrixClientContext);
    const isMe = userId === cli.getUserId();
    const userTrust = cli.checkUserTrust(userId);

    /** is the device verified? */
    const isVerified = useAsyncMemo(async () => {
        const deviceTrust = await cli.getCrypto()?.getDeviceVerificationStatus(userId, device.deviceId);
        if (!deviceTrust) return false;

        // For your own devices, we use the stricter check of cross-signing
        // verification to encourage everyone to trust their own devices via
        // cross-signing so that other users can then safely trust you.
        // For other people's devices, the more general verified check that
        // includes locally verified devices can be used.
        return isMe ? deviceTrust.crossSigningVerified : deviceTrust.isVerified();
    }, [cli, userId, device]);

    const classes = classNames("mx_UserInfo_device", {
        mx_UserInfo_device_verified: isVerified,
        mx_UserInfo_device_unverified: !isVerified,
    });
    const iconClasses = classNames("mx_E2EIcon", {
        mx_E2EIcon_normal: !userTrust.isVerified(),
        mx_E2EIcon_verified: isVerified,
        mx_E2EIcon_warning: userTrust.isVerified() && !isVerified,
    });

    const onDeviceClick = (): void => {
        const user = cli.getUser(userId);
        if (user) {
            verifyDevice(cli, user, device);
        }
    };

    let deviceName;
    if (!device.displayName?.trim()) {
        deviceName = device.deviceId;
    } else {
        deviceName = device.ambiguous ? device.displayName + " (" + device.deviceId + ")" : device.displayName;
    }

    let trustedLabel: string | undefined;
    if (userTrust.isVerified()) trustedLabel = isVerified ? _t("Trusted") : _t("Not trusted");

    if (isVerified === undefined) {
        // we're still deciding if the device is verified
        return <div className={classes} title={device.deviceId} />;
    } else if (isVerified) {
        return (
            <div className={classes} title={device.deviceId}>
                <div className={iconClasses} />
                <div className="mx_UserInfo_device_name">{deviceName}</div>
                <div className="mx_UserInfo_device_trusted">{trustedLabel}</div>
            </div>
        );
    } else {
        return (
            <AccessibleButton className={classes} title={device.deviceId} onClick={onDeviceClick}>
                <div className={iconClasses} />
                <div className="mx_UserInfo_device_name">{deviceName}</div>
                <div className="mx_UserInfo_device_trusted">{trustedLabel}</div>
            </AccessibleButton>
        );
    }
}

function DevicesSection({
    devices,
    userId,
    loading,
}: {
    devices: IDevice[];
    userId: string;
    loading: boolean;
}): JSX.Element {
    const cli = useContext(MatrixClientContext);
    const userTrust = cli.checkUserTrust(userId);

    const [isExpanded, setExpanded] = useState(false);

    const deviceTrusts = useAsyncMemo(() => {
        const cryptoApi = cli.getCrypto();
        if (!cryptoApi) return Promise.resolve(undefined);
        return Promise.all(devices.map((d) => cryptoApi.getDeviceVerificationStatus(userId, d.deviceId)));
    }, [cli, userId, devices]);

    if (loading || deviceTrusts === undefined) {
        // still loading
        return <Spinner />;
    }
    const isMe = userId === cli.getUserId();

    let expandSectionDevices: IDevice[] = [];
    const unverifiedDevices: IDevice[] = [];

    let expandCountCaption;
    let expandHideCaption;
    let expandIconClasses = "mx_E2EIcon";

    if (userTrust.isVerified()) {
        for (let i = 0; i < devices.length; ++i) {
            const device = devices[i];
            const deviceTrust = deviceTrusts[i];
            // For your own devices, we use the stricter check of cross-signing
            // verification to encourage everyone to trust their own devices via
            // cross-signing so that other users can then safely trust you.
            // For other people's devices, the more general verified check that
            // includes locally verified devices can be used.
            const isVerified = deviceTrust && (isMe ? deviceTrust.crossSigningVerified : deviceTrust.isVerified());

            if (isVerified) {
                expandSectionDevices.push(device);
            } else {
                unverifiedDevices.push(device);
            }
        }
        expandCountCaption = _t("%(count)s verified sessions", { count: expandSectionDevices.length });
        expandHideCaption = _t("Hide verified sessions");
        expandIconClasses += " mx_E2EIcon_verified";
    } else {
        expandSectionDevices = devices;
        expandCountCaption = _t("%(count)s sessions", { count: devices.length });
        expandHideCaption = _t("Hide sessions");
        expandIconClasses += " mx_E2EIcon_normal";
    }

    let expandButton;
    if (expandSectionDevices.length) {
        if (isExpanded) {
            expandButton = (
                <AccessibleButton kind="link" className="mx_UserInfo_expand" onClick={() => setExpanded(false)}>
                    <div>{expandHideCaption}</div>
                </AccessibleButton>
            );
        } else {
            expandButton = (
                <AccessibleButton kind="link" className="mx_UserInfo_expand" onClick={() => setExpanded(true)}>
                    <div className={expandIconClasses} />
                    <div>{expandCountCaption}</div>
                </AccessibleButton>
            );
        }
    }

    let deviceList = unverifiedDevices.map((device, i) => {
        return <DeviceItem key={i} userId={userId} device={device} />;
    });
    if (isExpanded) {
        const keyStart = unverifiedDevices.length;
        deviceList = deviceList.concat(
            expandSectionDevices.map((device, i) => {
                return <DeviceItem key={i + keyStart} userId={userId} device={device} />;
            }),
        );
    }

    return (
        <div className="mx_UserInfo_devices">
            <div>{deviceList}</div>
            <div>{expandButton}</div>
        </div>
    );
}

const MessageButton = ({ member }: { member: Member }): JSX.Element => {
    const cli = useContext(MatrixClientContext);
    const [busy, setBusy] = useState(false);

    return (
        <AccessibleButton
            kind="link"
            onClick={async () => {
                if (busy) return;
                setBusy(true);
                await openDmForUser(cli, member);
                setBusy(false);
            }}
            className="mx_UserInfo_field"
            disabled={busy}
        >
            {_t("Message")}
        </AccessibleButton>
    );
};

export const UserOptionsSection: React.FC<{
    member: Member;
    isIgnored: boolean;
    canInvite: boolean;
    isSpace?: boolean;
}> = ({ member, isIgnored, canInvite, isSpace }) => {
    const cli = useContext(MatrixClientContext);

    let ignoreButton: JSX.Element | undefined;
    let insertPillButton: JSX.Element | undefined;
    let inviteUserButton: JSX.Element | undefined;
    let readReceiptButton: JSX.Element | undefined;

    const isMe = member.userId === cli.getUserId();
    const onShareUserClick = (): void => {
        Modal.createDialog(ShareDialog, {
            target: member,
        });
    };

    const unignore = useCallback(() => {
        const ignoredUsers = cli.getIgnoredUsers();
        const index = ignoredUsers.indexOf(member.userId);
        if (index !== -1) ignoredUsers.splice(index, 1);
        cli.setIgnoredUsers(ignoredUsers);
    }, [cli, member]);

    const ignore = useCallback(async () => {
        const name = (member instanceof User ? member.displayName : member.name) || member.userId;
        const { finished } = Modal.createDialog(QuestionDialog, {
            title: _t("Ignore %(user)s", { user: name }),
            description: (
                <div>
                    {_t(
                        "All messages and invites from this user will be hidden. " +
                            "Are you sure you want to ignore them?",
                    )}
                </div>
            ),
            button: _t("Ignore"),
        });
        const [confirmed] = await finished;

        if (confirmed) {
            const ignoredUsers = cli.getIgnoredUsers();
            ignoredUsers.push(member.userId);
            cli.setIgnoredUsers(ignoredUsers);
        }
    }, [cli, member]);

    // Only allow the user to ignore the user if its not ourselves
    // same goes for jumping to read receipt
    if (!isMe) {
        ignoreButton = (
            <AccessibleButton
                onClick={isIgnored ? unignore : ignore}
                kind="link"
                className={classNames("mx_UserInfo_field", { mx_UserInfo_destructive: !isIgnored })}
            >
                {isIgnored ? _t("Unignore") : _t("Ignore")}
            </AccessibleButton>
        );

        if (member instanceof RoomMember && member.roomId && !isSpace) {
            const onReadReceiptButton = function (): void {
                const room = cli.getRoom(member.roomId);
                dis.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    highlighted: true,
                    // this could return null, the default prevents a type error
                    event_id: room?.getEventReadUpTo(member.userId) || undefined,
                    room_id: member.roomId,
                    metricsTrigger: undefined, // room doesn't change
                });
            };

            const onInsertPillButton = function (): void {
                dis.dispatch<ComposerInsertPayload>({
                    action: Action.ComposerInsert,
                    userId: member.userId,
                    timelineRenderingType: TimelineRenderingType.Room,
                });
            };

            const room = member instanceof RoomMember ? cli.getRoom(member.roomId) : undefined;
            if (room?.getEventReadUpTo(member.userId)) {
                readReceiptButton = (
                    <AccessibleButton kind="link" onClick={onReadReceiptButton} className="mx_UserInfo_field">
                        {_t("Jump to read receipt")}
                    </AccessibleButton>
                );
            }

            insertPillButton = (
                <AccessibleButton kind="link" onClick={onInsertPillButton} className="mx_UserInfo_field">
                    {_t("Mention")}
                </AccessibleButton>
            );
        }

        if (
            member instanceof RoomMember &&
            canInvite &&
            (member?.membership ?? "leave") === "leave" &&
            shouldShowComponent(UIComponent.InviteUsers)
        ) {
            const roomId = member && member.roomId ? member.roomId : SdkContextClass.instance.roomViewStore.getRoomId();
            const onInviteUserButton = async (ev: ButtonEvent): Promise<void> => {
                try {
                    // We use a MultiInviter to re-use the invite logic, even though we're only inviting one user.
                    const inviter = new MultiInviter(cli, roomId || "");
                    await inviter.invite([member.userId]).then(() => {
                        if (inviter.getCompletionState(member.userId) !== "invited") {
                            const errorStringFromInviterUtility = inviter.getErrorText(member.userId);
                            if (errorStringFromInviterUtility) {
                                throw new Error(errorStringFromInviterUtility);
                            } else {
                                throw new UserFriendlyError(
                                    `User (%(user)s) did not end up as invited to %(roomId)s but no error was given from the inviter utility`,
                                    { user: member.userId, roomId, cause: undefined },
                                );
                            }
                        }
                    });
                } catch (err) {
                    const description = err instanceof Error ? err.message : _t("Operation failed");

                    Modal.createDialog(ErrorDialog, {
                        title: _t("Failed to invite"),
                        description,
                    });
                }

                PosthogTrackers.trackInteraction("WebRightPanelRoomUserInfoInviteButton", ev);
            };

            inviteUserButton = (
                <AccessibleButton kind="link" onClick={onInviteUserButton} className="mx_UserInfo_field">
                    {_t("Invite")}
                </AccessibleButton>
            );
        }
    }

    const shareUserButton = (
        <AccessibleButton kind="link" onClick={onShareUserClick} className="mx_UserInfo_field">
            {_t("Share Link to User")}
        </AccessibleButton>
    );

    const directMessageButton = isMe ? null : <MessageButton member={member} />;

    return (
        <div className="mx_UserInfo_container">
            <h3>{_t("Options")}</h3>
            <div>
                {directMessageButton}
                {readReceiptButton}
                {shareUserButton}
                {insertPillButton}
                {inviteUserButton}
                {ignoreButton}
            </div>
        </div>
    );
};

const warnSelfDemote = async (isSpace: boolean): Promise<boolean> => {
    const { finished } = Modal.createDialog(QuestionDialog, {
        title: _t("Demote yourself?"),
        description: (
            <div>
                {isSpace
                    ? _t(
                          "You will not be able to undo this change as you are demoting yourself, " +
                              "if you are the last privileged user in the space it will be impossible " +
                              "to regain privileges.",
                      )
                    : _t(
                          "You will not be able to undo this change as you are demoting yourself, " +
                              "if you are the last privileged user in the room it will be impossible " +
                              "to regain privileges.",
                      )}
            </div>
        ),
        button: _t("Demote"),
    });

    const [confirmed] = await finished;
    return !!confirmed;
};

const GenericAdminToolsContainer: React.FC<{
    children: ReactNode;
}> = ({ children }) => {
    return (
        <div className="mx_UserInfo_container">
            <h3>{_t("Admin Tools")}</h3>
            <div className="mx_UserInfo_buttons">{children}</div>
        </div>
    );
};

interface IPowerLevelsContent {
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

export const getPowerLevels = (room: Room): IPowerLevelsContent =>
    room?.currentState?.getStateEvents(EventType.RoomPowerLevels, "")?.getContent() || {};

export const useRoomPowerLevels = (cli: MatrixClient, room: Room): IPowerLevelsContent => {
    const [powerLevels, setPowerLevels] = useState<IPowerLevelsContent>(getPowerLevels(room));

    const update = useCallback(
        (ev?: MatrixEvent) => {
            if (!room) return;
            if (ev && ev.getType() !== EventType.RoomPowerLevels) return;
            setPowerLevels(getPowerLevels(room));
        },
        [room],
    );

    useTypedEventEmitter(cli, RoomStateEvent.Events, update);
    useEffect(() => {
        update();
        return () => {
            setPowerLevels({});
        };
    }, [update]);
    return powerLevels;
};

interface IBaseProps {
    member: RoomMember;
    startUpdating(): void;
    stopUpdating(): void;
}

export const RoomKickButton = ({
    room,
    member,
    startUpdating,
    stopUpdating,
}: Omit<IBaseRoomProps, "powerLevels">): JSX.Element | null => {
    const cli = useContext(MatrixClientContext);

    // check if user can be kicked/disinvited
    if (member.membership !== "invite" && member.membership !== "join") return <></>;

    const onKick = async (): Promise<void> => {
        const commonProps = {
            member,
            action: room.isSpaceRoom()
                ? member.membership === "invite"
                    ? _t("Disinvite from space")
                    : _t("Remove from space")
                : member.membership === "invite"
                ? _t("Disinvite from room")
                : _t("Remove from room"),
            title:
                member.membership === "invite"
                    ? _t("Disinvite from %(roomName)s", { roomName: room.name })
                    : _t("Remove from %(roomName)s", { roomName: room.name }),
            askReason: member.membership === "join",
            danger: true,
        };

        let finished: Promise<[success?: boolean, reason?: string, rooms?: Room[]]>;

        if (room.isSpaceRoom()) {
            ({ finished } = Modal.createDialog(
                ConfirmSpaceUserActionDialog,
                {
                    ...commonProps,
                    space: room,
                    spaceChildFilter: (child: Room) => {
                        // Return true if the target member is not banned and we have sufficient PL to ban them
                        const myMember = child.getMember(cli.credentials.userId || "");
                        const theirMember = child.getMember(member.userId);
                        return (
                            !!myMember &&
                            !!theirMember &&
                            theirMember.membership === member.membership &&
                            myMember.powerLevel > theirMember.powerLevel &&
                            child.currentState.hasSufficientPowerLevelFor("kick", myMember.powerLevel)
                        );
                    },
                    allLabel: _t("Remove them from everything I'm able to"),
                    specificLabel: _t("Remove them from specific things I'm able to"),
                    warningMessage: _t("They'll still be able to access whatever you're not an admin of."),
                },
                "mx_ConfirmSpaceUserActionDialog_wrapper",
            ));
        } else {
            ({ finished } = Modal.createDialog(ConfirmUserActionDialog, commonProps));
        }

        const [proceed, reason, rooms = []] = await finished;
        if (!proceed) return;

        startUpdating();

        bulkSpaceBehaviour(room, rooms, (room) => cli.kick(room.roomId, member.userId, reason || undefined))
            .then(
                () => {
                    // NO-OP; rely on the m.room.member event coming down else we could
                    // get out of sync if we force setState here!
                    logger.log("Kick success");
                },
                function (err) {
                    logger.error("Kick error: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("Failed to remove user"),
                        description: err && err.message ? err.message : "Operation failed",
                    });
                },
            )
            .finally(() => {
                stopUpdating();
            });
    };

    const kickLabel = room.isSpaceRoom()
        ? member.membership === "invite"
            ? _t("Disinvite from space")
            : _t("Remove from space")
        : member.membership === "invite"
        ? _t("Disinvite from room")
        : _t("Remove from room");

    return (
        <AccessibleButton kind="link" className="mx_UserInfo_field mx_UserInfo_destructive" onClick={onKick}>
            {kickLabel}
        </AccessibleButton>
    );
};

const RedactMessagesButton: React.FC<IBaseProps> = ({ member }) => {
    const cli = useContext(MatrixClientContext);

    const onRedactAllMessages = (): void => {
        const room = cli.getRoom(member.roomId);
        if (!room) return;

        Modal.createDialog(BulkRedactDialog, {
            matrixClient: cli,
            room,
            member,
        });
    };

    return (
        <AccessibleButton
            kind="link"
            className="mx_UserInfo_field mx_UserInfo_destructive"
            onClick={onRedactAllMessages}
        >
            {_t("Remove recent messages")}
        </AccessibleButton>
    );
};

export const BanToggleButton = ({
    room,
    member,
    startUpdating,
    stopUpdating,
}: Omit<IBaseRoomProps, "powerLevels">): JSX.Element => {
    const cli = useContext(MatrixClientContext);

    const isBanned = member.membership === "ban";
    const onBanOrUnban = async (): Promise<void> => {
        const commonProps = {
            member,
            action: room.isSpaceRoom()
                ? isBanned
                    ? _t("Unban from space")
                    : _t("Ban from space")
                : isBanned
                ? _t("Unban from room")
                : _t("Ban from room"),
            title: isBanned
                ? _t("Unban from %(roomName)s", { roomName: room.name })
                : _t("Ban from %(roomName)s", { roomName: room.name }),
            askReason: !isBanned,
            danger: !isBanned,
        };

        let finished: Promise<[success?: boolean, reason?: string, rooms?: Room[]]>;

        if (room.isSpaceRoom()) {
            ({ finished } = Modal.createDialog(
                ConfirmSpaceUserActionDialog,
                {
                    ...commonProps,
                    space: room,
                    spaceChildFilter: isBanned
                        ? (child: Room) => {
                              // Return true if the target member is banned and we have sufficient PL to unban
                              const myMember = child.getMember(cli.credentials.userId || "");
                              const theirMember = child.getMember(member.userId);
                              return (
                                  !!myMember &&
                                  !!theirMember &&
                                  theirMember.membership === "ban" &&
                                  myMember.powerLevel > theirMember.powerLevel &&
                                  child.currentState.hasSufficientPowerLevelFor("ban", myMember.powerLevel)
                              );
                          }
                        : (child: Room) => {
                              // Return true if the target member isn't banned and we have sufficient PL to ban
                              const myMember = child.getMember(cli.credentials.userId || "");
                              const theirMember = child.getMember(member.userId);
                              return (
                                  !!myMember &&
                                  !!theirMember &&
                                  theirMember.membership !== "ban" &&
                                  myMember.powerLevel > theirMember.powerLevel &&
                                  child.currentState.hasSufficientPowerLevelFor("ban", myMember.powerLevel)
                              );
                          },
                    allLabel: isBanned
                        ? _t("Unban them from everything I'm able to")
                        : _t("Ban them from everything I'm able to"),
                    specificLabel: isBanned
                        ? _t("Unban them from specific things I'm able to")
                        : _t("Ban them from specific things I'm able to"),
                    warningMessage: isBanned
                        ? _t("They won't be able to access whatever you're not an admin of.")
                        : _t("They'll still be able to access whatever you're not an admin of."),
                },
                "mx_ConfirmSpaceUserActionDialog_wrapper",
            ));
        } else {
            ({ finished } = Modal.createDialog(ConfirmUserActionDialog, commonProps));
        }

        const [proceed, reason, rooms = []] = await finished;
        if (!proceed) return;

        startUpdating();

        const fn = (roomId: string): Promise<unknown> => {
            if (isBanned) {
                return cli.unban(roomId, member.userId);
            } else {
                return cli.ban(roomId, member.userId, reason || undefined);
            }
        };

        bulkSpaceBehaviour(room, rooms, (room) => fn(room.roomId))
            .then(
                () => {
                    // NO-OP; rely on the m.room.member event coming down else we could
                    // get out of sync if we force setState here!
                    logger.log("Ban success");
                },
                function (err) {
                    logger.error("Ban error: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("Error"),
                        description: _t("Failed to ban user"),
                    });
                },
            )
            .finally(() => {
                stopUpdating();
            });
    };

    let label = room.isSpaceRoom() ? _t("Ban from space") : _t("Ban from room");
    if (isBanned) {
        label = room.isSpaceRoom() ? _t("Unban from space") : _t("Unban from room");
    }

    const classes = classNames("mx_UserInfo_field", {
        mx_UserInfo_destructive: !isBanned,
    });

    return (
        <AccessibleButton kind="link" className={classes} onClick={onBanOrUnban}>
            {label}
        </AccessibleButton>
    );
};

interface IBaseRoomProps extends IBaseProps {
    room: Room;
    powerLevels: IPowerLevelsContent;
    children?: ReactNode;
}

const MuteToggleButton: React.FC<IBaseRoomProps> = ({ member, room, powerLevels, startUpdating, stopUpdating }) => {
    const cli = useContext(MatrixClientContext);

    // Don't show the mute/unmute option if the user is not in the room
    if (member.membership !== "join") return null;

    const muted = isMuted(member, powerLevels);
    const onMuteToggle = async (): Promise<void> => {
        const roomId = member.roomId;
        const target = member.userId;

        // if muting self, warn as it may be irreversible
        if (target === cli.getUserId()) {
            try {
                if (!(await warnSelfDemote(room?.isSpaceRoom()))) return;
            } catch (e) {
                logger.error("Failed to warn about self demotion: ", e);
                return;
            }
        }

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        if (!powerLevelEvent) return;

        const powerLevels = powerLevelEvent.getContent();
        const levelToSend =
            (powerLevels.events ? powerLevels.events["m.room.message"] : null) || powerLevels.events_default;
        let level;
        if (muted) {
            // unmute
            level = levelToSend;
        } else {
            // mute
            level = levelToSend - 1;
        }
        level = parseInt(level);

        if (!isNaN(level)) {
            startUpdating();
            cli.setPowerLevel(roomId, target, level, powerLevelEvent)
                .then(
                    () => {
                        // NO-OP; rely on the m.room.member event coming down else we could
                        // get out of sync if we force setState here!
                        logger.log("Mute toggle success");
                    },
                    function (err) {
                        logger.error("Mute error: " + err);
                        Modal.createDialog(ErrorDialog, {
                            title: _t("Error"),
                            description: _t("Failed to mute user"),
                        });
                    },
                )
                .finally(() => {
                    stopUpdating();
                });
        }
    };

    const classes = classNames("mx_UserInfo_field", {
        mx_UserInfo_destructive: !muted,
    });

    const muteLabel = muted ? _t("Unmute") : _t("Mute");
    return (
        <AccessibleButton kind="link" className={classes} onClick={onMuteToggle}>
            {muteLabel}
        </AccessibleButton>
    );
};

export const RoomAdminToolsContainer: React.FC<IBaseRoomProps> = ({
    room,
    children,
    member,
    startUpdating,
    stopUpdating,
    powerLevels,
}) => {
    const cli = useContext(MatrixClientContext);
    let kickButton;
    let banButton;
    let muteButton;
    let redactButton;

    const editPowerLevel =
        (powerLevels.events ? powerLevels.events["m.room.power_levels"] : null) || powerLevels.state_default;

    // if these do not exist in the event then they should default to 50 as per the spec
    const { ban: banPowerLevel = 50, kick: kickPowerLevel = 50, redact: redactPowerLevel = 50 } = powerLevels;

    const me = room.getMember(cli.getUserId() || "");
    if (!me) {
        // we aren't in the room, so return no admin tooling
        return <div />;
    }

    const isMe = me.userId === member.userId;
    const canAffectUser = member.powerLevel < me.powerLevel || isMe;

    if (!isMe && canAffectUser && me.powerLevel >= kickPowerLevel) {
        kickButton = (
            <RoomKickButton room={room} member={member} startUpdating={startUpdating} stopUpdating={stopUpdating} />
        );
    }
    if (me.powerLevel >= redactPowerLevel && !room.isSpaceRoom()) {
        redactButton = (
            <RedactMessagesButton member={member} startUpdating={startUpdating} stopUpdating={stopUpdating} />
        );
    }
    if (!isMe && canAffectUser && me.powerLevel >= banPowerLevel) {
        banButton = (
            <BanToggleButton room={room} member={member} startUpdating={startUpdating} stopUpdating={stopUpdating} />
        );
    }
    if (!isMe && canAffectUser && me.powerLevel >= Number(editPowerLevel) && !room.isSpaceRoom()) {
        muteButton = (
            <MuteToggleButton
                member={member}
                room={room}
                powerLevels={powerLevels}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            />
        );
    }

    if (kickButton || banButton || muteButton || redactButton || children) {
        return (
            <GenericAdminToolsContainer>
                {muteButton}
                {kickButton}
                {banButton}
                {redactButton}
                {children}
            </GenericAdminToolsContainer>
        );
    }

    return <div />;
};

const useIsSynapseAdmin = (cli?: MatrixClient): boolean => {
    return useAsyncMemo(async () => (cli ? cli.isSynapseAdministrator().catch(() => false) : false), [cli], false);
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

interface IRoomPermissions {
    modifyLevelMax: number;
    canEdit: boolean;
    canInvite: boolean;
}

function useRoomPermissions(cli: MatrixClient, room: Room, user: RoomMember): IRoomPermissions {
    const [roomPermissions, setRoomPermissions] = useState<IRoomPermissions>({
        // modifyLevelMax is the max PL we can set this user to, typically min(their PL, our PL) && canSetPL
        modifyLevelMax: -1,
        canEdit: false,
        canInvite: false,
    });

    const updateRoomPermissions = useCallback(() => {
        const powerLevels = room?.currentState.getStateEvents(EventType.RoomPowerLevels, "")?.getContent();
        if (!powerLevels) return;

        const me = room.getMember(cli.getUserId() || "");
        if (!me) return;

        const them = user;
        const isMe = me.userId === them.userId;
        const canAffectUser = them.powerLevel < me.powerLevel || isMe;

        let modifyLevelMax = -1;
        if (canAffectUser) {
            const editPowerLevel = powerLevels.events?.[EventType.RoomPowerLevels] ?? powerLevels.state_default ?? 50;
            if (me.powerLevel >= editPowerLevel) {
                modifyLevelMax = me.powerLevel;
            }
        }

        setRoomPermissions({
            canInvite: me.powerLevel >= (powerLevels.invite ?? 0),
            canEdit: modifyLevelMax >= 0,
            modifyLevelMax,
        });
    }, [cli, user, room]);

    useTypedEventEmitter(cli, RoomStateEvent.Update, updateRoomPermissions);
    useEffect(() => {
        updateRoomPermissions();
        return () => {
            setRoomPermissions({
                modifyLevelMax: -1,
                canEdit: false,
                canInvite: false,
            });
        };
    }, [updateRoomPermissions]);

    return roomPermissions;
}

const PowerLevelSection: React.FC<{
    user: RoomMember;
    room: Room;
    roomPermissions: IRoomPermissions;
    powerLevels: IPowerLevelsContent;
}> = ({ user, room, roomPermissions, powerLevels }) => {
    if (roomPermissions.canEdit) {
        return <PowerLevelEditor user={user} room={room} roomPermissions={roomPermissions} />;
    } else {
        const powerLevelUsersDefault = powerLevels.users_default || 0;
        const powerLevel = user.powerLevel;
        const role = textualPowerLevel(powerLevel, powerLevelUsersDefault);
        return (
            <div className="mx_UserInfo_profileField">
                <div className="mx_UserInfo_roleDescription">{role}</div>
            </div>
        );
    }
};

export const PowerLevelEditor: React.FC<{
    user: RoomMember;
    room: Room;
    roomPermissions: IRoomPermissions;
}> = ({ user, room, roomPermissions }) => {
    const cli = useContext(MatrixClientContext);

    const [selectedPowerLevel, setSelectedPowerLevel] = useState(user.powerLevel);
    useEffect(() => {
        setSelectedPowerLevel(user.powerLevel);
    }, [user]);

    const onPowerChange = useCallback(
        async (powerLevel: number) => {
            setSelectedPowerLevel(powerLevel);

            const applyPowerChange = (
                roomId: string,
                target: string,
                powerLevel: number,
                powerLevelEvent: MatrixEvent,
            ): Promise<unknown> => {
                return cli.setPowerLevel(roomId, target, powerLevel, powerLevelEvent).then(
                    function () {
                        // NO-OP; rely on the m.room.member event coming down else we could
                        // get out of sync if we force setState here!
                        logger.log("Power change success");
                    },
                    function (err) {
                        logger.error("Failed to change power level " + err);
                        Modal.createDialog(ErrorDialog, {
                            title: _t("Error"),
                            description: _t("Failed to change power level"),
                        });
                    },
                );
            };

            const roomId = user.roomId;
            const target = user.userId;

            const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
            if (!powerLevelEvent) return;

            const myUserId = cli.getUserId();
            const myPower = powerLevelEvent.getContent().users[myUserId || ""];
            if (myPower && parseInt(myPower) <= powerLevel && myUserId !== target) {
                const { finished } = Modal.createDialog(QuestionDialog, {
                    title: _t("Warning!"),
                    description: (
                        <div>
                            {_t(
                                "You will not be able to undo this change as you are promoting the user " +
                                    "to have the same power level as yourself.",
                            )}
                            <br />
                            {_t("Are you sure?")}
                        </div>
                    ),
                    button: _t("Continue"),
                });

                const [confirmed] = await finished;
                if (!confirmed) return;
            } else if (myUserId === target && myPower && parseInt(myPower) > powerLevel) {
                // If we are changing our own PL it can only ever be decreasing, which we cannot reverse.
                try {
                    if (!(await warnSelfDemote(room?.isSpaceRoom()))) return;
                } catch (e) {
                    logger.error("Failed to warn about self demotion: ", e);
                }
            }

            await applyPowerChange(roomId, target, powerLevel, powerLevelEvent);
        },
        [user.roomId, user.userId, cli, room],
    );

    const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
    const powerLevelUsersDefault = powerLevelEvent ? powerLevelEvent.getContent().users_default : 0;

    return (
        <div className="mx_UserInfo_profileField">
            <PowerSelector
                label={undefined}
                value={selectedPowerLevel}
                maxValue={roomPermissions.modifyLevelMax}
                usersDefault={powerLevelUsersDefault}
                onChange={onPowerChange}
            />
        </div>
    );
};

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
            } catch (err) {
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
        const onDeviceVerificationChanged = (_userId: string, deviceId: string): void => {
            if (_userId !== userId) return;
            updateDevices();
        };
        const onUserTrustStatusChanged = (_userId: string, trustLevel: UserTrustLevel): void => {
            if (_userId !== userId) return;
            updateDevices();
        };
        cli.on(CryptoEvent.DevicesUpdated, onDevicesUpdated);
        cli.on(CryptoEvent.DeviceVerificationChanged, onDeviceVerificationChanged);
        cli.on(CryptoEvent.UserTrustStatusChanged, onUserTrustStatusChanged);
        // Handle being unmounted
        return () => {
            cancel = true;
            cli.removeListener(CryptoEvent.DevicesUpdated, onDevicesUpdated);
            cli.removeListener(CryptoEvent.DeviceVerificationChanged, onDeviceVerificationChanged);
            cli.removeListener(CryptoEvent.UserTrustStatusChanged, onUserTrustStatusChanged);
        };
    }, [cli, userId]);

    return devices;
};

const BasicUserInfo: React.FC<{
    room: Room;
    member: User | RoomMember;
    devices: IDevice[];
    isRoomEncrypted: boolean;
}> = ({ room, member, devices, isRoomEncrypted }) => {
    const cli = useContext(MatrixClientContext);

    const powerLevels = useRoomPowerLevels(cli, room);
    // Load whether or not we are a Synapse Admin
    const isSynapseAdmin = useIsSynapseAdmin(cli);

    // Check whether the user is ignored
    const [isIgnored, setIsIgnored] = useState(cli.isUserIgnored(member.userId));
    // Recheck if the user or client changes
    useEffect(() => {
        setIsIgnored(cli.isUserIgnored(member.userId));
    }, [cli, member.userId]);
    // Recheck also if we receive new accountData m.ignored_user_list
    const accountDataHandler = useCallback(
        (ev) => {
            if (ev.getType() === "m.ignored_user_list") {
                setIsIgnored(cli.isUserIgnored(member.userId));
            }
        },
        [cli, member.userId],
    );
    useTypedEventEmitter(cli, ClientEvent.AccountData, accountDataHandler);

    // Count of how many operations are currently in progress, if > 0 then show a Spinner
    const [pendingUpdateCount, setPendingUpdateCount] = useState(0);
    const startUpdating = useCallback(() => {
        setPendingUpdateCount(pendingUpdateCount + 1);
    }, [pendingUpdateCount]);
    const stopUpdating = useCallback(() => {
        setPendingUpdateCount(pendingUpdateCount - 1);
    }, [pendingUpdateCount]);

    const roomPermissions = useRoomPermissions(cli, room, member as RoomMember);

    const onSynapseDeactivate = useCallback(async () => {
        const { finished } = Modal.createDialog(QuestionDialog, {
            title: _t("Deactivate user?"),
            description: (
                <div>
                    {_t(
                        "Deactivating this user will log them out and prevent them from logging back in. Additionally, " +
                            "they will leave all the rooms they are in. This action cannot be reversed. Are you sure you " +
                            "want to deactivate this user?",
                    )}
                </div>
            ),
            button: _t("Deactivate user"),
            danger: true,
        });

        const [accepted] = await finished;
        if (!accepted) return;
        try {
            await cli.deactivateSynapseUser(member.userId);
        } catch (err) {
            logger.error("Failed to deactivate user");
            logger.error(err);

            const description = err instanceof Error ? err.message : _t("Operation failed");

            Modal.createDialog(ErrorDialog, {
                title: _t("Failed to deactivate user"),
                description,
            });
        }
    }, [cli, member.userId]);

    let synapseDeactivateButton;
    let spinner;

    // We don't need a perfect check here, just something to pass as "probably not our homeserver". If
    // someone does figure out how to bypass this check the worst that happens is an error.
    // FIXME this should be using cli instead of MatrixClientPeg.matrixClient
    if (isSynapseAdmin && member.userId.endsWith(`:${MatrixClientPeg.getHomeserverName()}`)) {
        synapseDeactivateButton = (
            <AccessibleButton
                kind="link"
                className="mx_UserInfo_field mx_UserInfo_destructive"
                onClick={onSynapseDeactivate}
            >
                {_t("Deactivate user")}
            </AccessibleButton>
        );
    }

    let memberDetails;
    let adminToolsContainer;
    if (room && (member as RoomMember).roomId) {
        // hide the Roles section for DMs as it doesn't make sense there
        if (!DMRoomMap.shared().getUserIdForRoomId((member as RoomMember).roomId)) {
            memberDetails = (
                <div className="mx_UserInfo_container">
                    <h3>
                        {_t(
                            "Role in <RoomName/>",
                            {},
                            {
                                RoomName: () => <b>{room.name}</b>,
                            },
                        )}
                    </h3>
                    <PowerLevelSection
                        powerLevels={powerLevels}
                        user={member as RoomMember}
                        room={room}
                        roomPermissions={roomPermissions}
                    />
                </div>
            );
        }

        adminToolsContainer = (
            <RoomAdminToolsContainer
                powerLevels={powerLevels}
                member={member as RoomMember}
                room={room}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            >
                {synapseDeactivateButton}
            </RoomAdminToolsContainer>
        );
    } else if (synapseDeactivateButton) {
        adminToolsContainer = <GenericAdminToolsContainer>{synapseDeactivateButton}</GenericAdminToolsContainer>;
    }

    if (pendingUpdateCount > 0) {
        spinner = <Spinner />;
    }

    // only display the devices list if our client supports E2E
    const cryptoEnabled = cli.isCryptoEnabled();

    let text;
    if (!isRoomEncrypted) {
        if (!cryptoEnabled) {
            text = _t("This client does not support end-to-end encryption.");
        } else if (room && !room.isSpaceRoom()) {
            text = _t("Messages in this room are not end-to-end encrypted.");
        }
    } else if (!room.isSpaceRoom()) {
        text = _t("Messages in this room are end-to-end encrypted.");
    }

    let verifyButton;
    const homeserverSupportsCrossSigning = useHomeserverSupportsCrossSigning(cli);

    const userTrust = cryptoEnabled && cli.checkUserTrust(member.userId);
    const userVerified = cryptoEnabled && userTrust && userTrust.isCrossSigningVerified();
    const isMe = member.userId === cli.getUserId();
    const canVerify =
        cryptoEnabled && homeserverSupportsCrossSigning && !userVerified && !isMe && devices && devices.length > 0;

    const setUpdating: SetUpdating = (updating) => {
        setPendingUpdateCount((count) => count + (updating ? 1 : -1));
    };
    const hasCrossSigningKeys = useHasCrossSigningKeys(cli, member as User, canVerify, setUpdating);

    const showDeviceListSpinner = devices === undefined;
    if (canVerify) {
        if (hasCrossSigningKeys !== undefined) {
            // Note: mx_UserInfo_verifyButton is for the end-to-end tests
            verifyButton = (
                <div className="mx_UserInfo_container_verifyButton">
                    <AccessibleButton
                        kind="link"
                        className="mx_UserInfo_field mx_UserInfo_verifyButton"
                        onClick={() => {
                            if (hasCrossSigningKeys) {
                                verifyUser(cli, member as User);
                            } else {
                                legacyVerifyUser(cli, member as User);
                            }
                        }}
                    >
                        {_t("Verify")}
                    </AccessibleButton>
                </div>
            );
        } else if (!showDeviceListSpinner) {
            // HACK: only show a spinner if the device section spinner is not shown,
            // to avoid showing a double spinner
            // We should ask for a design that includes all the different loading states here
            verifyButton = <Spinner />;
        }
    }

    let editDevices;
    if (member.userId == cli.getUserId()) {
        editDevices = (
            <div>
                <AccessibleButton
                    kind="link"
                    className="mx_UserInfo_field"
                    onClick={() => {
                        dis.dispatch({
                            action: Action.ViewUserDeviceSettings,
                        });
                    }}
                >
                    {_t("Edit devices")}
                </AccessibleButton>
            </div>
        );
    }

    const securitySection = (
        <div className="mx_UserInfo_container">
            <h3>{_t("Security")}</h3>
            <p>{text}</p>
            {verifyButton}
            {cryptoEnabled && (
                <DevicesSection loading={showDeviceListSpinner} devices={devices} userId={member.userId} />
            )}
            {editDevices}
        </div>
    );

    return (
        <React.Fragment>
            {memberDetails}

            {securitySection}
            <UserOptionsSection
                canInvite={roomPermissions.canInvite}
                isIgnored={isIgnored}
                member={member as RoomMember}
                isSpace={room?.isSpaceRoom()}
            />

            {adminToolsContainer}

            {spinner}
        </React.Fragment>
    );
};

export type Member = User | RoomMember;

export const UserInfoHeader: React.FC<{
    member: Member;
    e2eStatus?: E2EStatus;
    roomId?: string;
}> = ({ member, e2eStatus, roomId }) => {
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

    const avatarElement = (
        <div className="mx_UserInfo_avatar">
            <div className="mx_UserInfo_avatar_transition">
                <div className="mx_UserInfo_avatar_transition_child">
                    <MemberAvatar
                        key={member.userId} // to instantly blank the avatar when UserInfo changes members
                        member={member as RoomMember}
                        width={2 * 0.3 * UIStore.instance.windowHeight} // 2x@30vh
                        height={2 * 0.3 * UIStore.instance.windowHeight} // 2x@30vh
                        resizeMethod="scale"
                        fallbackUserId={member.userId}
                        onClick={onMemberAvatarClick}
                        urls={avatarUrl ? [avatarUrl] : undefined}
                    />
                </div>
            </div>
        </div>
    );

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
            />
        );
    }

    const e2eIcon = e2eStatus ? <E2EIcon size={18} status={e2eStatus} isUser={true} /> : null;

    const displayName = (member as RoomMember).rawDisplayName;
    return (
        <React.Fragment>
            {avatarElement}

            <div className="mx_UserInfo_container mx_UserInfo_separator">
                <div className="mx_UserInfo_profile">
                    <div>
                        <h2>
                            <span title={displayName} aria-label={displayName} dir="auto">
                                {displayName}
                            </span>
                            {e2eIcon}
                        </h2>
                    </div>
                    <div className="mx_UserInfo_profile_mxid">
                        {UserIdentifierCustomisations.getDisplayUserIdentifier?.(member.userId, {
                            roomId,
                            withDisplayName: true,
                        })}
                    </div>
                    <div className="mx_UserInfo_profileStatus">{presenceLabel}</div>
                </div>
            </div>
        </React.Fragment>
    );
};

interface IProps {
    user: Member;
    room?: Room;
    phase: RightPanelPhases.RoomMemberInfo | RightPanelPhases.SpaceMemberInfo | RightPanelPhases.EncryptionPanel;
    onClose(): void;
    verificationRequest?: VerificationRequest;
    verificationRequestPromise?: Promise<VerificationRequest>;
}

const UserInfo: React.FC<IProps> = ({ user, room, onClose, phase = RightPanelPhases.RoomMemberInfo, ...props }) => {
    const cli = useContext(MatrixClientContext);

    // fetch latest room member if we have a room, so we don't show historical information, falling back to user
    const member = useMemo(() => (room ? room.getMember(user.userId) || user : user), [room, user]);

    const isRoomEncrypted = useIsEncrypted(cli, room);
    const devices = useDevices(user.userId) ?? [];

    const e2eStatus = useAsyncMemo(async () => {
        if (!isRoomEncrypted || !devices) {
            return undefined;
        }
        return await getE2EStatus(cli, user.userId, devices);
    }, [cli, isRoomEncrypted, user.userId, devices]);

    const classes = ["mx_UserInfo"];

    let cardState: IRightPanelCardState = {};
    // We have no previousPhase for when viewing a UserInfo without a Room at this time
    if (room && phase === RightPanelPhases.EncryptionPanel) {
        cardState = { member };
    } else if (room?.isSpaceRoom()) {
        cardState = { spaceId: room.roomId };
    }

    const onEncryptionPanelClose = (): void => {
        RightPanelStore.instance.popCard();
    };

    let content: JSX.Element | undefined;
    switch (phase) {
        case RightPanelPhases.RoomMemberInfo:
        case RightPanelPhases.SpaceMemberInfo:
            content = (
                <BasicUserInfo
                    room={room as Room}
                    member={member as User}
                    devices={devices}
                    isRoomEncrypted={Boolean(isRoomEncrypted)}
                />
            );
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
            closeLabel = _t("Cancel");
        }
    }

    let scopeHeader;
    if (room?.isSpaceRoom()) {
        scopeHeader = (
            <div data-testid="space-header" className="mx_RightPanel_scopeHeader">
                <RoomAvatar room={room} height={32} width={32} />
                <RoomName room={room} />
            </div>
        );
    }

    const header = (
        <>
            {scopeHeader}
            <UserInfoHeader member={member} e2eStatus={e2eStatus} roomId={room?.roomId} />
        </>
    );
    return (
        <BaseCard
            className={classes.join(" ")}
            header={header}
            onClose={onClose}
            closeLabel={closeLabel}
            cardState={cardState}
            onBack={(ev: ButtonEvent) => {
                if (RightPanelStore.instance.previousCard.phase === RightPanelPhases.RoomMemberList) {
                    PosthogTrackers.trackInteraction("WebRightPanelRoomUserInfoBackButton", ev);
                }
            }}
        >
            {content}
        </BaseCard>
    );
};

export default UserInfo;
