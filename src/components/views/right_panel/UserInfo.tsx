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
import { MenuItem } from "@vector-im/compound-web";
import ChatIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";
import ShareIcon from "@vector-im/compound-design-tokens/assets/web/icons/share";
import MentionIcon from "@vector-im/compound-design-tokens/assets/web/icons/mention";
import InviteIcon from "@vector-im/compound-design-tokens/assets/web/icons/user-add";
import BlockIcon from "@vector-im/compound-design-tokens/assets/web/icons/block";
import DeleteIcon from "@vector-im/compound-design-tokens/assets/web/icons/delete";

import dis from "../../../dispatcher/dispatcher";
import Modal from "../../../Modal";
import { _t, UserFriendlyError } from "../../../languageHandler";
import DMRoomMap from "../../../utils/DMRoomMap";
import { type ButtonEvent } from "../elements/AccessibleButton";
import MultiInviter from "../../../utils/MultiInviter";
import { useTypedEventEmitter } from "../../../hooks/useEventEmitter";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import EncryptionPanel from "./EncryptionPanel";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import { Action } from "../../../dispatcher/actions";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted";
import BaseCard from "./BaseCard";
import Spinner from "../elements/Spinner";
import { ShareDialog } from "../dialogs/ShareDialog";
import ErrorDialog from "../dialogs/ErrorDialog";
import QuestionDialog from "../dialogs/QuestionDialog";
import { type ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { TimelineRenderingType } from "../../../contexts/RoomContext";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { type IRightPanelCardState } from "../../../stores/right-panel/RightPanelStoreIPanelState";
import PosthogTrackers from "../../../PosthogTrackers";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { DirectoryMember, startDmOnFirstMessage } from "../../../utils/direct-messages";
import { SdkContextClass } from "../../../contexts/SDKContext";
import { UserInfoAdminToolsContainer } from "./user_info/UserInfoAdminToolsContainer";
import { PowerLevelSection } from "./user_info/UserInfoPowerLevels";
import { UserInfoHeaderView } from "./user_info/UserInfoHeaderView";

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

const useIsSynapseAdmin = (cli?: MatrixClient): boolean => {
    return useAsyncMemo(async () => (cli ? cli.isSynapseAdministrator().catch(() => false) : false), [cli], false);
};

export interface IRoomPermissions {
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
}> = ({ room, member }) => {
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
                <PowerLevelSection user={member as RoomMember} room={room} roomPermissions={roomPermissions} />
            );
        }

        adminToolsContainer = (
            <UserInfoAdminToolsContainer
                powerLevels={powerLevels}
                member={member as RoomMember}
                room={room}
                isUpdating={pendingUpdateCount > 0}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            >
                {synapseDeactivateButton}
            </UserInfoAdminToolsContainer>
        );
    } else if (synapseDeactivateButton) {
        adminToolsContainer = <Container>{synapseDeactivateButton}</Container>;
    }

    if (pendingUpdateCount > 0) {
        spinner = <Spinner />;
    }

    const isMe = member.userId === cli.getUserId();

    return (
        <React.Fragment>
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
            content = <BasicUserInfo room={room as Room} member={member as User} />;
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
