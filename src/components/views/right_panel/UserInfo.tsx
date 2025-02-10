/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import {
    ClientEvent,
    type MatrixClient,
    RoomMember,
    type Room,
    RoomStateEvent,
    type MatrixEvent,
    User,
    type Device,
    EventType,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { type UserVerificationStatus, type VerificationRequest, CryptoEvent } from "matrix-js-sdk/src/crypto-api";
import { logger } from "matrix-js-sdk/src/logger";
import { Heading, MenuItem, Text, Tooltip } from "@vector-im/compound-web";
import ChatIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";
import ShareIcon from "@vector-im/compound-design-tokens/assets/web/icons/share";
import MentionIcon from "@vector-im/compound-design-tokens/assets/web/icons/mention";
import InviteIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";
import BlockIcon from "@vector-im/compound-design-tokens/assets/web/icons/block";
import DeleteIcon from "@vector-im/compound-design-tokens/assets/web/icons/delete";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import ChatProblemIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat-problem";
import VisibilityOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/visibility-off";
import LeaveIcon from "@vector-im/compound-design-tokens/assets/web/icons/leave";

import dis from "../../../dispatcher/dispatcher";
import Modal from "../../../Modal";
import { _t, UserFriendlyError } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import SdkConfig from "../../../SdkConfig";
import MultiInviter from "../../../utils/MultiInviter";
import E2EIcon from "../rooms/E2EIcon";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import { textualPowerLevel } from "../../../Roles";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import EncryptionPanel from "./EncryptionPanel";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import { verifyDevice, verifyUser } from "../../../verification";
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
import { ShareDialog } from "../dialogs/ShareDialog";
import ErrorDialog from "../dialogs/ErrorDialog";
import QuestionDialog from "../dialogs/QuestionDialog";
import ConfirmUserActionDialog from "../dialogs/ConfirmUserActionDialog";
import { mediaFromMxc } from "../../../customisations/Media";
import { type ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import ConfirmSpaceUserActionDialog from "../dialogs/ConfirmSpaceUserActionDialog";
import { bulkSpaceBehaviour } from "../../../utils/space";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { TimelineRenderingType } from "../../../contexts/RoomContext";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { type IRightPanelCardState } from "../../../stores/right-panel/RightPanelStoreIPanelState";
import UserIdentifierCustomisations from "../../../customisations/UserIdentifier";
import PosthogTrackers from "../../../PosthogTrackers";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { DirectoryMember, startDmOnFirstMessage } from "../../../utils/direct-messages";
import { SdkContextClass } from "../../../contexts/SDKContext";
import { asyncSome } from "../../../utils/arrays";
import { Flex } from "../../utils/Flex";
import CopyableText from "../elements/CopyableText";
import { useUserTimezone } from "../../../hooks/useUserTimezone";

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

export const getE2EStatus = async (
    cli: MatrixClient,
    userId: string,
    devices: IDevice[],
): Promise<E2EStatus | undefined> => {
    const crypto = cli.getCrypto();
    if (!crypto) return undefined;
    const isMe = userId === cli.getUserId();
    const userTrust = await crypto.getUserVerificationStatus(userId);
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
        const deviceTrust = await crypto.getDeviceVerificationStatus(userId, deviceId);
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
            return await cli.getCrypto()?.userHasCrossSigningKeys(member.userId, true);
        } finally {
            setUpdating(false);
        }
    }, [cli, member, canVerify]);
}

/**
 * Display one device and the related actions
 * @param userId current user id
 * @param device device to display
 * @param isUserVerified false when the user is not verified
 * @constructor
 */
export function DeviceItem({
    userId,
    device,
    isUserVerified,
}: {
    userId: string;
    device: IDevice;
    isUserVerified: boolean;
}): JSX.Element {
    const cli = useContext(MatrixClientContext);
    const isMe = userId === cli.getUserId();

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
        mx_E2EIcon_normal: !isUserVerified,
        mx_E2EIcon_verified: isVerified,
        mx_E2EIcon_warning: isUserVerified && !isVerified,
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
    if (isUserVerified) trustedLabel = isVerified ? _t("common|trusted") : _t("common|not_trusted");

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
            <AccessibleButton
                className={classes}
                title={device.deviceId}
                aria-label={deviceName}
                onClick={onDeviceClick}
            >
                <div className={iconClasses} />
                <div className="mx_UserInfo_device_name">{deviceName}</div>
                <div className="mx_UserInfo_device_trusted">{trustedLabel}</div>
            </AccessibleButton>
        );
    }
}

/**
 * Display a list of devices
 * @param devices devices to display
 * @param userId current user id
 * @param loading displays a spinner instead of the device section
 * @param isUserVerified is false when
 *  - the user is not verified, or
 *  - `MatrixClient.getCrypto.getUserVerificationStatus` async call is in progress (in which case `loading` will also be `true`)
 * @constructor
 */
function DevicesSection({
    devices,
    userId,
    loading,
    isUserVerified,
}: {
    devices: IDevice[];
    userId: string;
    loading: boolean;
    isUserVerified: boolean;
}): JSX.Element {
    const cli = useContext(MatrixClientContext);

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

    const dehydratedDeviceIds: string[] = [];
    for (const device of devices) {
        if (device.dehydrated) {
            dehydratedDeviceIds.push(device.deviceId);
        }
    }
    // If the user has exactly one device marked as dehydrated, we consider
    // that as the dehydrated device, and hide it as a normal device (but
    // indicate that the user is using a dehydrated device).  If the user has
    // more than one, that is anomalous, and we show all the devices so that
    // nothing is hidden.
    const dehydratedDeviceId: string | undefined = dehydratedDeviceIds.length == 1 ? dehydratedDeviceIds[0] : undefined;
    let dehydratedDeviceInExpandSection = false;

    if (isUserVerified) {
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
                // don't show dehydrated device as a normal device, if it's
                // verified
                if (device.deviceId === dehydratedDeviceId) {
                    dehydratedDeviceInExpandSection = true;
                } else {
                    expandSectionDevices.push(device);
                }
            } else {
                unverifiedDevices.push(device);
            }
        }
        expandCountCaption = _t("user_info|count_of_verified_sessions", { count: expandSectionDevices.length });
        expandHideCaption = _t("user_info|hide_verified_sessions");
        expandIconClasses += " mx_E2EIcon_verified";
    } else {
        if (dehydratedDeviceId) {
            devices = devices.filter((device) => device.deviceId !== dehydratedDeviceId);
            dehydratedDeviceInExpandSection = true;
        }
        expandSectionDevices = devices;
        expandCountCaption = _t("user_info|count_of_sessions", { count: devices.length });
        expandHideCaption = _t("user_info|hide_sessions");
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
        return <DeviceItem key={i} userId={userId} device={device} isUserVerified={isUserVerified} />;
    });
    if (isExpanded) {
        const keyStart = unverifiedDevices.length;
        deviceList = deviceList.concat(
            expandSectionDevices.map((device, i) => {
                return (
                    <DeviceItem key={i + keyStart} userId={userId} device={device} isUserVerified={isUserVerified} />
                );
            }),
        );
        if (dehydratedDeviceInExpandSection) {
            deviceList.push(<div>{_t("user_info|dehydrated_device_enabled")}</div>);
        }
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
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                if (busy) return;
                setBusy(true);
                await openDmForUser(cli, member);
                setBusy(false);
            }}
            disabled={busy}
            label={_t("user_info|send_message")}
            Icon={ChatIcon}
        />
    );
};

export const UserOptionsSection: React.FC<{
    member: Member;
    canInvite: boolean;
    isSpace?: boolean;
    children?: ReactNode;
}> = ({ member, canInvite, isSpace, children }) => {
    const cli = useContext(MatrixClientContext);

    let insertPillButton: JSX.Element | undefined;
    let inviteUserButton: JSX.Element | undefined;
    let readReceiptButton: JSX.Element | undefined;

    const isMe = member.userId === cli.getUserId();
    const onShareUserClick = (): void => {
        Modal.createDialog(ShareDialog, {
            target: member,
        });
    };

    // Only allow the user to ignore the user if its not ourselves
    // same goes for jumping to read receipt
    if (!isMe) {
        const onReadReceiptButton = function (room: Room): void {
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                highlighted: true,
                // this could return null, the default prevents a type error
                event_id: room.getEventReadUpTo(member.userId) || undefined,
                room_id: room.roomId,
                metricsTrigger: undefined, // room doesn't change
            });
        };

        const room = member instanceof RoomMember ? cli.getRoom(member.roomId) : null;
        const readReceiptButtonDisabled = isSpace || !room?.getEventReadUpTo(member.userId);
        readReceiptButton = (
            <MenuItem
                role="button"
                onSelect={async (ev) => {
                    ev.preventDefault();
                    if (room && !readReceiptButtonDisabled) {
                        onReadReceiptButton(room);
                    }
                }}
                label={_t("user_info|jump_to_rr_button")}
                disabled={readReceiptButtonDisabled}
                Icon={CheckIcon}
            />
        );

        if (member instanceof RoomMember && member.roomId && !isSpace) {
            const onInsertPillButton = function (): void {
                dis.dispatch<ComposerInsertPayload>({
                    action: Action.ComposerInsert,
                    userId: member.userId,
                    timelineRenderingType: TimelineRenderingType.Room,
                });
            };

            insertPillButton = (
                <MenuItem
                    role="button"
                    onSelect={async (ev) => {
                        ev.preventDefault();
                        onInsertPillButton();
                    }}
                    label={_t("action|mention")}
                    Icon={MentionIcon}
                />
            );
        }

        if (
            member instanceof RoomMember &&
            canInvite &&
            (member?.membership ?? KnownMembership.Leave) === KnownMembership.Leave &&
            shouldShowComponent(UIComponent.InviteUsers)
        ) {
            const roomId = member && member.roomId ? member.roomId : SdkContextClass.instance.roomViewStore.getRoomId();
            const onInviteUserButton = async (ev: Event): Promise<void> => {
                try {
                    // We use a MultiInviter to re-use the invite logic, even though we're only inviting one user.
                    const inviter = new MultiInviter(cli, roomId || "");
                    await inviter.invite([member.userId]).then(() => {
                        if (inviter.getCompletionState(member.userId) !== "invited") {
                            const errorStringFromInviterUtility = inviter.getErrorText(member.userId);
                            if (errorStringFromInviterUtility) {
                                throw new Error(errorStringFromInviterUtility);
                            } else {
                                throw new UserFriendlyError("slash_command|invite_failed", {
                                    user: member.userId,
                                    roomId,
                                    cause: undefined,
                                });
                            }
                        }
                    });
                } catch (err) {
                    const description = err instanceof Error ? err.message : _t("invite|failed_generic");

                    Modal.createDialog(ErrorDialog, {
                        title: _t("invite|failed_title"),
                        description,
                    });
                }

                PosthogTrackers.trackInteraction("WebRightPanelRoomUserInfoInviteButton", ev);
            };

            inviteUserButton = (
                <MenuItem
                    role="button"
                    onSelect={async (ev) => {
                        ev.preventDefault();
                        onInviteUserButton(ev);
                    }}
                    label={_t("action|invite")}
                    Icon={InviteIcon}
                />
            );
        }
    }

    const shareUserButton = (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                onShareUserClick();
            }}
            label={_t("user_info|share_button")}
            Icon={ShareIcon}
        />
    );

    const directMessageButton =
        isMe || !shouldShowComponent(UIComponent.CreateRooms) ? null : <MessageButton member={member} />;

    return (
        <Container>
            {children}
            {directMessageButton}
            {inviteUserButton}
            {readReceiptButton}
            {shareUserButton}
            {insertPillButton}
        </Container>
    );
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

const Container: React.FC<{
    children: ReactNode;
    className?: string;
}> = ({ children, className }) => {
    const classes = classNames("mx_UserInfo_container", className);
    return <div className={classes}>{children}</div>;
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
    isUpdating: boolean;
    startUpdating(): void;
    stopUpdating(): void;
}

export const RoomKickButton = ({
    room,
    member,
    isUpdating,
    startUpdating,
    stopUpdating,
}: Omit<IBaseRoomProps, "powerLevels">): JSX.Element | null => {
    const cli = useContext(MatrixClientContext);

    // check if user can be kicked/disinvited
    if (member.membership !== KnownMembership.Invite && member.membership !== KnownMembership.Join) return <></>;

    const onKick = async (): Promise<void> => {
        if (isUpdating) return; // only allow one operation at a time
        startUpdating();

        const commonProps = {
            member,
            action: room.isSpaceRoom()
                ? member.membership === KnownMembership.Invite
                    ? _t("user_info|disinvite_button_space")
                    : _t("user_info|kick_button_space")
                : member.membership === KnownMembership.Invite
                  ? _t("user_info|disinvite_button_room")
                  : _t("user_info|kick_button_room"),
            title:
                member.membership === KnownMembership.Invite
                    ? _t("user_info|disinvite_button_room_name", { roomName: room.name })
                    : _t("user_info|kick_button_room_name", { roomName: room.name }),
            askReason: member.membership === KnownMembership.Join,
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
                    allLabel: _t("user_info|kick_button_space_everything"),
                    specificLabel: _t("user_info|kick_space_specific"),
                    warningMessage: _t("user_info|kick_space_warning"),
                },
                "mx_ConfirmSpaceUserActionDialog_wrapper",
            ));
        } else {
            ({ finished } = Modal.createDialog(ConfirmUserActionDialog, commonProps));
        }

        const [proceed, reason, rooms = []] = await finished;
        if (!proceed) {
            stopUpdating();
            return;
        }

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
                        title: _t("user_info|error_kicking_user"),
                        description: err?.message ?? "Operation failed",
                    });
                },
            )
            .finally(() => {
                stopUpdating();
            });
    };

    const kickLabel = room.isSpaceRoom()
        ? member.membership === KnownMembership.Invite
            ? _t("user_info|disinvite_button_space")
            : _t("user_info|kick_button_space")
        : member.membership === KnownMembership.Invite
          ? _t("user_info|disinvite_button_room")
          : _t("user_info|kick_button_room");

    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                onKick();
            }}
            disabled={isUpdating}
            label={kickLabel}
            kind="critical"
            Icon={LeaveIcon}
        />
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
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                onRedactAllMessages();
            }}
            label={_t("user_info|redact_button")}
            kind="critical"
            Icon={CloseIcon}
        />
    );
};

export const BanToggleButton = ({
    room,
    member,
    isUpdating,
    startUpdating,
    stopUpdating,
}: Omit<IBaseRoomProps, "powerLevels">): JSX.Element => {
    const cli = useContext(MatrixClientContext);

    const isBanned = member.membership === KnownMembership.Ban;
    const onBanOrUnban = async (): Promise<void> => {
        if (isUpdating) return; // only allow one operation at a time
        startUpdating();

        const commonProps = {
            member,
            action: room.isSpaceRoom()
                ? isBanned
                    ? _t("user_info|unban_button_space")
                    : _t("user_info|ban_button_space")
                : isBanned
                  ? _t("user_info|unban_button_room")
                  : _t("user_info|ban_button_room"),
            title: isBanned
                ? _t("user_info|unban_room_confirm_title", { roomName: room.name })
                : _t("user_info|ban_room_confirm_title", { roomName: room.name }),
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
                                  theirMember.membership === KnownMembership.Ban &&
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
                                  theirMember.membership !== KnownMembership.Ban &&
                                  myMember.powerLevel > theirMember.powerLevel &&
                                  child.currentState.hasSufficientPowerLevelFor("ban", myMember.powerLevel)
                              );
                          },
                    allLabel: isBanned ? _t("user_info|unban_space_everything") : _t("user_info|ban_space_everything"),
                    specificLabel: isBanned ? _t("user_info|unban_space_specific") : _t("user_info|ban_space_specific"),
                    warningMessage: isBanned ? _t("user_info|unban_space_warning") : _t("user_info|kick_space_warning"),
                },
                "mx_ConfirmSpaceUserActionDialog_wrapper",
            ));
        } else {
            ({ finished } = Modal.createDialog(ConfirmUserActionDialog, commonProps));
        }

        const [proceed, reason, rooms = []] = await finished;
        if (!proceed) {
            stopUpdating();
            return;
        }

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
                        title: _t("common|error"),
                        description: _t("user_info|error_ban_user"),
                    });
                },
            )
            .finally(() => {
                stopUpdating();
            });
    };

    let label = room.isSpaceRoom() ? _t("user_info|ban_button_space") : _t("user_info|ban_button_room");
    if (isBanned) {
        label = room.isSpaceRoom() ? _t("user_info|unban_button_space") : _t("user_info|unban_button_room");
    }

    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                onBanOrUnban();
            }}
            disabled={isUpdating}
            label={label}
            kind="critical"
            Icon={ChatProblemIcon}
        />
    );
};

interface IBaseRoomProps extends IBaseProps {
    room: Room;
    powerLevels: IPowerLevelsContent;
    children?: ReactNode;
}

// We do not show a Mute button for ourselves so it doesn't need to handle warning self demotion
const MuteToggleButton: React.FC<IBaseRoomProps> = ({
    member,
    room,
    powerLevels,
    isUpdating,
    startUpdating,
    stopUpdating,
}) => {
    const cli = useContext(MatrixClientContext);

    // Don't show the mute/unmute option if the user is not in the room
    if (member.membership !== KnownMembership.Join) return null;

    const muted = isMuted(member, powerLevels);
    const onMuteToggle = async (): Promise<void> => {
        if (isUpdating) return; // only allow one operation at a time
        startUpdating();

        const roomId = member.roomId;
        const target = member.userId;

        const powerLevelEvent = room.currentState.getStateEvents("m.room.power_levels", "");
        const powerLevels = powerLevelEvent?.getContent();
        const levelToSend = powerLevels?.events?.["m.room.message"] ?? powerLevels?.events_default;
        let level;
        if (muted) {
            // unmute
            level = levelToSend;
        } else {
            // mute
            level = levelToSend - 1;
        }
        level = parseInt(level);

        if (isNaN(level)) {
            stopUpdating();
            return;
        }

        cli.setPowerLevel(roomId, target, level)
            .then(
                () => {
                    // NO-OP; rely on the m.room.member event coming down else we could
                    // get out of sync if we force setState here!
                    logger.log("Mute toggle success");
                },
                function (err) {
                    logger.error("Mute error: " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t("common|error"),
                        description: _t("user_info|error_mute_user"),
                    });
                },
            )
            .finally(() => {
                stopUpdating();
            });
    };

    const muteLabel = muted ? _t("common|unmute") : _t("common|mute");
    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                onMuteToggle();
            }}
            disabled={isUpdating}
            label={muteLabel}
            kind="critical"
            Icon={VisibilityOffIcon}
        />
    );
};

const IgnoreToggleButton: React.FC<{
    member: User | RoomMember;
}> = ({ member }) => {
    const cli = useContext(MatrixClientContext);
    const unignore = useCallback(() => {
        const ignoredUsers = cli.getIgnoredUsers();
        const index = ignoredUsers.indexOf(member.userId);
        if (index !== -1) ignoredUsers.splice(index, 1);
        cli.setIgnoredUsers(ignoredUsers);
    }, [cli, member]);

    const ignore = useCallback(async () => {
        const name = (member instanceof User ? member.displayName : member.name) || member.userId;
        const { finished } = Modal.createDialog(QuestionDialog, {
            title: _t("user_info|ignore_confirm_title", { user: name }),
            description: <div>{_t("user_info|ignore_confirm_description")}</div>,
            button: _t("action|ignore"),
        });
        const [confirmed] = await finished;

        if (confirmed) {
            const ignoredUsers = cli.getIgnoredUsers();
            ignoredUsers.push(member.userId);
            cli.setIgnoredUsers(ignoredUsers);
        }
    }, [cli, member]);

    // Check whether the user is ignored
    const [isIgnored, setIsIgnored] = useState(cli.isUserIgnored(member.userId));
    // Recheck if the user or client changes
    useEffect(() => {
        setIsIgnored(cli.isUserIgnored(member.userId));
    }, [cli, member.userId]);
    // Recheck also if we receive new accountData m.ignored_user_list
    const accountDataHandler = useCallback(
        (ev: MatrixEvent) => {
            if (ev.getType() === "m.ignored_user_list") {
                setIsIgnored(cli.isUserIgnored(member.userId));
            }
        },
        [cli, member.userId],
    );
    useTypedEventEmitter(cli, ClientEvent.AccountData, accountDataHandler);

    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                if (isIgnored) {
                    unignore();
                } else {
                    ignore();
                }
            }}
            label={isIgnored ? _t("user_info|unignore_button") : _t("user_info|ignore_button")}
            kind="critical"
            Icon={BlockIcon}
        />
    );
};

export const RoomAdminToolsContainer: React.FC<IBaseRoomProps> = ({
    room,
    children,
    member,
    isUpdating,
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
            <RoomKickButton
                room={room}
                member={member}
                isUpdating={isUpdating}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            />
        );
    }
    if (me.powerLevel >= redactPowerLevel && !room.isSpaceRoom()) {
        redactButton = (
            <RedactMessagesButton
                member={member}
                isUpdating={isUpdating}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            />
        );
    }
    if (!isMe && canAffectUser && me.powerLevel >= banPowerLevel) {
        banButton = (
            <BanToggleButton
                room={room}
                member={member}
                isUpdating={isUpdating}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            />
        );
    }
    if (!isMe && canAffectUser && me.powerLevel >= Number(editPowerLevel) && !room.isSpaceRoom()) {
        muteButton = (
            <MuteToggleButton
                member={member}
                room={room}
                powerLevels={powerLevels}
                isUpdating={isUpdating}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            />
        );
    }

    if (kickButton || banButton || muteButton || redactButton || children) {
        return (
            <Container>
                {muteButton}
                {redactButton}
                {kickButton}
                {banButton}
                {children}
            </Container>
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

            const applyPowerChange = (roomId: string, target: string, powerLevel: number): Promise<unknown> => {
                return cli.setPowerLevel(roomId, target, powerLevel).then(
                    function () {
                        // NO-OP; rely on the m.room.member event coming down else we could
                        // get out of sync if we force setState here!
                        logger.log("Power change success");
                    },
                    function (err) {
                        logger.error("Failed to change power level " + err);
                        Modal.createDialog(ErrorDialog, {
                            title: _t("common|error"),
                            description: _t("error|update_power_level"),
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
                    title: _t("common|warning"),
                    description: (
                        <div>
                            {_t("user_info|promote_warning")}
                            <br />
                            {_t("common|are_you_sure")}
                        </div>
                    ),
                    button: _t("action|continue"),
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

            await applyPowerChange(roomId, target, powerLevel);
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
            title: _t("user_info|deactivate_confirm_title"),
            description: <div>{_t("user_info|deactivate_confirm_description")}</div>,
            button: _t("user_info|deactivate_confirm_action"),
            danger: true,
        });

        const [accepted] = await finished;
        if (!accepted) return;
        try {
            await cli.deactivateSynapseUser(member.userId);
        } catch (err) {
            logger.error("Failed to deactivate user");
            logger.error(err);

            const description = err instanceof Error ? err.message : _t("invite|failed_generic");

            Modal.createDialog(ErrorDialog, {
                title: _t("user_info|error_deactivate"),
                description,
            });
        }
    }, [cli, member.userId]);

    let synapseDeactivateButton;
    let spinner;

    // We don't need a perfect check here, just something to pass as "probably not our homeserver". If
    // someone does figure out how to bypass this check the worst that happens is an error.
    if (isSynapseAdmin && member.userId.endsWith(`:${cli.getDomain()}`)) {
        synapseDeactivateButton = (
            <MenuItem
                role="button"
                onSelect={async (ev) => {
                    ev.preventDefault();
                    onSynapseDeactivate();
                }}
                label={_t("user_info|deactivate_confirm_action")}
                kind="critical"
                Icon={DeleteIcon}
            />
        );
    }

    let memberDetails;
    let adminToolsContainer;
    if (room && (member as RoomMember).roomId) {
        // hide the Roles section for DMs as it doesn't make sense there
        if (!DMRoomMap.shared().getUserIdForRoomId((member as RoomMember).roomId)) {
            memberDetails = (
                <PowerLevelSection
                    powerLevels={powerLevels}
                    user={member as RoomMember}
                    room={room}
                    roomPermissions={roomPermissions}
                />
            );
        }

        adminToolsContainer = (
            <RoomAdminToolsContainer
                powerLevels={powerLevels}
                member={member as RoomMember}
                room={room}
                isUpdating={pendingUpdateCount > 0}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            >
                {synapseDeactivateButton}
            </RoomAdminToolsContainer>
        );
    } else if (synapseDeactivateButton) {
        adminToolsContainer = <Container>{synapseDeactivateButton}</Container>;
    }

    if (pendingUpdateCount > 0) {
        spinner = <Spinner />;
    }

    // only display the devices list if our client supports E2E
    const cryptoEnabled = Boolean(cli.getCrypto());

    let text;
    if (!isRoomEncrypted) {
        if (!cryptoEnabled) {
            text = _t("encryption|unsupported");
        } else if (room && !room.isSpaceRoom()) {
            text = _t("user_info|room_unencrypted");
        }
    } else if (!room.isSpaceRoom()) {
        text = _t("user_info|room_encrypted");
    }

    let verifyButton;
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

    const setUpdating: SetUpdating = (updating) => {
        setPendingUpdateCount((count) => count + (updating ? 1 : -1));
    };
    const hasCrossSigningKeys = useHasCrossSigningKeys(cli, member as User, canVerify, setUpdating);

    // Display the spinner only when
    // - the devices are not populated yet, or
    // - the crypto is available and we don't have the user verification status yet
    const showDeviceListSpinner = (cryptoEnabled && !hasUserVerificationStatus) || devices === undefined;
    if (canVerify) {
        if (hasCrossSigningKeys !== undefined) {
            // Note: mx_UserInfo_verifyButton is for the end-to-end tests
            verifyButton = (
                <div className="mx_UserInfo_container_verifyButton">
                    <AccessibleButton
                        kind="link"
                        className="mx_UserInfo_field mx_UserInfo_verifyButton"
                        onClick={() => verifyUser(cli, member as User)}
                    >
                        {_t("action|verify")}
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
                    {_t("user_info|edit_own_devices")}
                </AccessibleButton>
            </div>
        );
    }

    const securitySection = (
        <Container>
            <h2>{_t("common|security")}</h2>
            <p>{text}</p>
            {verifyButton}
            {cryptoEnabled && (
                <DevicesSection
                    loading={showDeviceListSpinner}
                    devices={devices}
                    userId={member.userId}
                    isUserVerified={isUserVerified}
                />
            )}
            {editDevices}
        </Container>
    );

    return (
        <React.Fragment>
            {securitySection}

            <UserOptionsSection
                canInvite={roomPermissions.canInvite}
                member={member as RoomMember}
                isSpace={room?.isSpaceRoom()}
            >
                {memberDetails}
            </UserOptionsSection>

            {adminToolsContainer}

            {!isMe && (
                <Container>
                    <IgnoreToggleButton member={member} />
                </Container>
            )}

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

    const e2eIcon = e2eStatus ? <E2EIcon size={18} status={e2eStatus} isUser={true} /> : null;
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
                            {e2eIcon}
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
    }

    const onEncryptionPanelClose = (): void => {
        RightPanelStore.instance.popCard();
    };

    let content: JSX.Element | undefined;
    switch (phase) {
        case RightPanelPhases.MemberInfo:
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
            closeLabel = _t("action|cancel");
        }
    }

    const header = (
        <>
            <UserInfoHeader member={member} e2eStatus={e2eStatus} roomId={room?.roomId} />
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
