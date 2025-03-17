/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useEffect, useState } from "react";
import { JoinRule, RestrictedAllowType, type Room, EventType, Visibility } from "matrix-js-sdk/src/matrix";
import { type RoomJoinRulesEventContent } from "matrix-js-sdk/src/types";

import StyledRadioGroup, { type IDefinition } from "../elements/StyledRadioGroup";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import RoomAvatar from "../avatars/RoomAvatar";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import Modal from "../../../Modal";
import ManageRestrictedJoinRuleDialog from "../dialogs/ManageRestrictedJoinRuleDialog";
import RoomUpgradeWarningDialog, { type IFinishedOpts } from "../dialogs/RoomUpgradeWarningDialog";
import { upgradeRoom } from "../../../utils/RoomUpgrade";
import { arrayHasDiff } from "../../../utils/arrays";
import { useLocalEcho } from "../../../hooks/useLocalEcho";
import dis from "../../../dispatcher/dispatcher";
import { RoomSettingsTab } from "../dialogs/RoomSettingsDialog";
import { Action } from "../../../dispatcher/actions";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { doesRoomVersionSupport, PreferredRoomVersions } from "../../../utils/PreferredRoomVersions";
import SettingsStore from "../../../settings/SettingsStore";
import LabelledCheckbox from "../elements/LabelledCheckbox";

export interface JoinRuleSettingsProps {
    room: Room;
    promptUpgrade?: boolean;
    closeSettingsFn(): void;
    onError(error: unknown): void;
    beforeChange?(joinRule: JoinRule): Promise<boolean>; // if returns false then aborts the change
    aliasWarning?: ReactNode;
}

const JoinRuleSettings: React.FC<JoinRuleSettingsProps> = ({
    room,
    promptUpgrade,
    aliasWarning,
    onError,
    beforeChange,
    closeSettingsFn,
}) => {
    const cli = room.client;

    const askToJoinEnabled = SettingsStore.getValue("feature_ask_to_join");
    const roomSupportsKnock = doesRoomVersionSupport(room.getVersion(), PreferredRoomVersions.KnockRooms);
    const preferredKnockVersion = !roomSupportsKnock && promptUpgrade ? PreferredRoomVersions.KnockRooms : undefined;

    const roomSupportsRestricted = doesRoomVersionSupport(room.getVersion(), PreferredRoomVersions.RestrictedRooms);
    const preferredRestrictionVersion =
        !roomSupportsRestricted && promptUpgrade ? PreferredRoomVersions.RestrictedRooms : undefined;

    const disabled = !room.currentState.mayClientSendStateEvent(EventType.RoomJoinRules, cli);

    const [content, setContent] = useLocalEcho<RoomJoinRulesEventContent | undefined, RoomJoinRulesEventContent>(
        () => room.currentState.getStateEvents(EventType.RoomJoinRules, "")?.getContent(),
        (content) => cli.sendStateEvent(room.roomId, EventType.RoomJoinRules, content, ""),
        onError,
    );

    const { join_rule: joinRule = JoinRule.Invite } = content || {};
    const restrictedAllowRoomIds =
        joinRule === JoinRule.Restricted
            ? content?.allow?.filter((o) => o.type === RestrictedAllowType.RoomMembership).map((o) => o.room_id)
            : undefined;

    const [isPublicKnockRoom, setIsPublicKnockRoom] = useState(false);

    useEffect(() => {
        if (joinRule === JoinRule.Knock) {
            cli.getRoomDirectoryVisibility(room.roomId)
                .then(({ visibility }) => setIsPublicKnockRoom(visibility === Visibility.Public))
                .catch(onError);
        }
    }, [cli, joinRule, onError, room.roomId]);

    const onIsPublicKnockRoomChange = (checked: boolean): void => {
        cli.setRoomDirectoryVisibility(room.roomId, checked ? Visibility.Public : Visibility.Private)
            .then(() => setIsPublicKnockRoom(checked))
            .catch(onError);
    };

    const editRestrictedRoomIds = async (): Promise<string[] | undefined> => {
        let selected = restrictedAllowRoomIds;
        if (!selected?.length && SpaceStore.instance.activeSpaceRoom) {
            selected = [SpaceStore.instance.activeSpaceRoom.roomId];
        }

        const { finished } = Modal.createDialog(
            ManageRestrictedJoinRuleDialog,
            {
                room,
                selected,
            },
            "mx_ManageRestrictedJoinRuleDialog_wrapper",
        );

        const [roomIds] = await finished;
        return roomIds;
    };

    const upgradeRequiredDialog = (targetVersion: string, description?: ReactNode): void => {
        Modal.createDialog(RoomUpgradeWarningDialog, {
            roomId: room.roomId,
            targetVersion,
            description,
            doUpgrade: async (
                opts: IFinishedOpts,
                fn: (progressText: string, progress: number, total: number) => void,
            ): Promise<void> => {
                const roomId = await upgradeRoom(room, targetVersion, opts.invite, true, true, true, (progress) => {
                    const total = 2 + progress.updateSpacesTotal + progress.inviteUsersTotal;
                    if (!progress.roomUpgraded) {
                        fn(_t("room_settings|security|join_rule_upgrade_upgrading_room"), 0, total);
                    } else if (!progress.roomSynced) {
                        fn(_t("room_settings|security|join_rule_upgrade_awaiting_room"), 1, total);
                    } else if (
                        progress.inviteUsersProgress !== undefined &&
                        progress.inviteUsersProgress < progress.inviteUsersTotal
                    ) {
                        fn(
                            _t("room_settings|security|join_rule_upgrade_sending_invites", {
                                progress: progress.inviteUsersProgress,
                                count: progress.inviteUsersTotal,
                            }),
                            2 + progress.inviteUsersProgress,
                            total,
                        );
                    } else if (
                        progress.updateSpacesProgress !== undefined &&
                        progress.updateSpacesProgress < progress.updateSpacesTotal
                    ) {
                        fn(
                            _t("room_settings|security|join_rule_upgrade_updating_spaces", {
                                progress: progress.updateSpacesProgress,
                                count: progress.updateSpacesTotal,
                            }),
                            2 + (progress.inviteUsersProgress ?? 0) + progress.updateSpacesProgress,
                            total,
                        );
                    }
                });

                closeSettingsFn();

                // switch to the new room in the background
                dis.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: roomId,
                    metricsTrigger: undefined, // other
                });

                // open new settings on this tab
                dis.dispatch({
                    action: "open_room_settings",
                    initial_tab_id: RoomSettingsTab.Security,
                });
            },
        });
    };

    const upgradeRequiredPill = (
        <span className="mx_JoinRuleSettings_upgradeRequired">
            {_t("room_settings|security|join_rule_upgrade_required")}
        </span>
    );

    const definitions: IDefinition<JoinRule>[] = [
        {
            value: JoinRule.Invite,
            label: _t("room_settings|security|join_rule_invite"),
            description: _t("room_settings|security|join_rule_invite_description"),
            checked:
                joinRule === JoinRule.Invite || (joinRule === JoinRule.Restricted && !restrictedAllowRoomIds?.length),
        },
        {
            value: JoinRule.Public,
            label: _t("common|public"),
            description: (
                <>
                    {_t("room_settings|security|join_rule_public_description")}
                    {aliasWarning}
                </>
            ),
        },
    ];

    if (roomSupportsRestricted || preferredRestrictionVersion || joinRule === JoinRule.Restricted) {
        let description;
        if (joinRule === JoinRule.Restricted && restrictedAllowRoomIds?.length) {
            // only show the first 4 spaces we know about, so that the UI doesn't grow out of proportion there are lots.
            const shownSpaces = restrictedAllowRoomIds
                .map((roomId) => cli.getRoom(roomId))
                .filter((room) => room?.isSpaceRoom())
                .slice(0, 4) as Room[];

            let moreText;
            if (shownSpaces.length < restrictedAllowRoomIds.length) {
                if (shownSpaces.length > 0) {
                    moreText = _t("room_settings|security|join_rule_restricted_n_more", {
                        count: restrictedAllowRoomIds.length - shownSpaces.length,
                    });
                } else {
                    moreText = _t("room_settings|security|join_rule_restricted_summary", {
                        count: restrictedAllowRoomIds.length,
                    });
                }
            }

            const onRestrictedRoomIdsChange = (newAllowRoomIds: string[]): void => {
                if (!arrayHasDiff(restrictedAllowRoomIds || [], newAllowRoomIds)) return;

                if (!newAllowRoomIds.length) {
                    setContent({
                        join_rule: JoinRule.Invite,
                    });
                    return;
                }

                setContent({
                    join_rule: JoinRule.Restricted,
                    allow: newAllowRoomIds.map((roomId) => ({
                        type: RestrictedAllowType.RoomMembership,
                        room_id: roomId,
                    })),
                });
            };

            const onEditRestrictedClick = async (): Promise<void> => {
                const restrictedAllowRoomIds = await editRestrictedRoomIds();
                if (!Array.isArray(restrictedAllowRoomIds)) return;
                if (restrictedAllowRoomIds.length > 0) {
                    onRestrictedRoomIdsChange(restrictedAllowRoomIds);
                } else {
                    onChange(JoinRule.Invite);
                }
            };

            description = (
                <div>
                    <span>
                        {_t(
                            "room_settings|security|join_rule_restricted_description",
                            {},
                            {
                                a: (sub) => (
                                    <AccessibleButton
                                        disabled={disabled}
                                        onClick={onEditRestrictedClick}
                                        kind="link_inline"
                                    >
                                        {sub}
                                    </AccessibleButton>
                                ),
                            },
                        )}
                    </span>

                    <div className="mx_JoinRuleSettings_spacesWithAccess">
                        <h4>{_t("room_settings|security|join_rule_restricted_description_spaces")}</h4>
                        {shownSpaces.map((room) => {
                            return (
                                <span key={room.roomId}>
                                    <RoomAvatar room={room} size="32px" />
                                    {room.name}
                                </span>
                            );
                        })}
                        {moreText && <span>{moreText}</span>}
                    </div>
                </div>
            );
        } else if (SpaceStore.instance.activeSpaceRoom) {
            description = _t(
                "room_settings|security|join_rule_restricted_description_active_space",
                {},
                {
                    spaceName: () => <strong>{SpaceStore.instance.activeSpaceRoom!.name}</strong>,
                },
            );
        } else {
            description = _t("room_settings|security|join_rule_restricted_description_prompt");
        }

        definitions.splice(1, 0, {
            value: JoinRule.Restricted,
            label: (
                <>
                    {_t("room_settings|security|join_rule_restricted")}
                    {preferredRestrictionVersion && upgradeRequiredPill}
                </>
            ),
            description,
            // if there are 0 allowed spaces then render it as invite only instead
            checked: joinRule === JoinRule.Restricted && !!restrictedAllowRoomIds?.length,
        });
    }

    if (askToJoinEnabled && (roomSupportsKnock || preferredKnockVersion)) {
        definitions.push({
            value: JoinRule.Knock,
            label: (
                <>
                    {_t("room_settings|security|join_rule_knock")}
                    {preferredKnockVersion && upgradeRequiredPill}
                </>
            ),
            description: (
                <>
                    {_t("room_settings|security|join_rule_knock_description")}
                    <LabelledCheckbox
                        className="mx_JoinRuleSettings_labelledCheckbox"
                        disabled={joinRule !== JoinRule.Knock}
                        label={
                            room.isSpaceRoom()
                                ? _t("room_settings|security|publish_space")
                                : _t("room_settings|security|publish_room")
                        }
                        onChange={onIsPublicKnockRoomChange}
                        value={isPublicKnockRoom}
                    />
                </>
            ),
        });
    }

    const onChange = async (joinRule: JoinRule): Promise<void> => {
        const beforeJoinRule = content?.join_rule;

        let restrictedAllowRoomIds: string[] | undefined;
        if (joinRule === JoinRule.Restricted) {
            if (beforeJoinRule === JoinRule.Restricted || roomSupportsRestricted) {
                // Have the user pick which spaces to allow joins from
                restrictedAllowRoomIds = await editRestrictedRoomIds();
                if (!Array.isArray(restrictedAllowRoomIds)) return;
            } else if (preferredRestrictionVersion) {
                // Block this action on a room upgrade otherwise it'd make their room unjoinable
                const targetVersion = preferredRestrictionVersion;

                let warning: JSX.Element | undefined;
                const userId = cli.getUserId()!;
                const unableToUpdateSomeParents = Array.from(SpaceStore.instance.getKnownParents(room.roomId)).some(
                    (roomId) => !cli.getRoom(roomId)?.currentState.maySendStateEvent(EventType.SpaceChild, userId),
                );
                if (unableToUpdateSomeParents) {
                    warning = <strong>{_t("room_settings|security|join_rule_restricted_upgrade_warning")}</strong>;
                }

                upgradeRequiredDialog(
                    targetVersion,
                    <>
                        {_t("room_settings|security|join_rule_restricted_upgrade_description")}
                        {warning}
                    </>,
                );

                return;
            }

            // when setting to 0 allowed rooms/spaces set to invite only instead as per the note
            if (!restrictedAllowRoomIds?.length) {
                joinRule = JoinRule.Invite;
            }
        } else if (joinRule === JoinRule.Knock) {
            if (preferredKnockVersion) {
                upgradeRequiredDialog(preferredKnockVersion);
                return;
            }
        }

        if (beforeJoinRule === joinRule && !restrictedAllowRoomIds) return;
        if (beforeChange && !(await beforeChange(joinRule))) return;

        const newContent: RoomJoinRulesEventContent = {
            join_rule: joinRule,
        };

        // pre-set the accepted spaces with the currently viewed one as per the microcopy
        if (joinRule === JoinRule.Restricted) {
            newContent.allow = restrictedAllowRoomIds?.map((roomId) => ({
                type: RestrictedAllowType.RoomMembership,
                room_id: roomId,
            }));
        }

        setContent(newContent);
    };

    return (
        <StyledRadioGroup
            name="joinRule"
            value={joinRule}
            onChange={onChange}
            definitions={definitions}
            disabled={disabled}
            className="mx_JoinRuleSettings_radioButton"
        />
    );
};

export default JoinRuleSettings;
