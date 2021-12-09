/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { useEffect, useRef, useState } from "react";
import { JoinRule } from "matrix-js-sdk/src/@types/partials";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from '../../../languageHandler';
import BaseDialog from "./BaseDialog";
import AccessibleButton from "../elements/AccessibleButton";
import { createSpace, SpaceCreateForm } from "../spaces/SpaceCreateMenu";
import JoinRuleDropdown from "../elements/JoinRuleDropdown";
import Field from "../elements/Field";
import RoomAliasField from "../elements/RoomAliasField";
import { GroupMember } from "../right_panel/UserInfo";
import { parseMembersResponse, parseRoomsResponse } from "../../../stores/GroupStore";
import { calculateRoomVia, makeRoomPermalink } from "../../../utils/permalinks/Permalinks";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import Spinner from "../elements/Spinner";
import { mediaFromMxc } from "../../../customisations/Media";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import Modal from "../../../Modal";
import InfoDialog from "./InfoDialog";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "./UserSettingsDialog";
import TagOrderActions from "../../../actions/TagOrderActions";
import { inviteUsersToRoom } from "../../../RoomInvite";
import ProgressBar from "../elements/ProgressBar";

interface IProps {
    matrixClient: MatrixClient;
    groupId: string;
    onFinished(spaceId?: string): void;
}

export const CreateEventField = "io.element.migrated_from_community";

interface IGroupRoom {
    displayname: string;
    name?: string;
    roomId: string;
    canonicalAlias?: string;
    avatarUrl?: string;
    topic?: string;
    numJoinedMembers?: number;
    worldReadable?: boolean;
    guestCanJoin?: boolean;
    isPublic?: boolean;
}

/* eslint-disable camelcase */
export interface IGroupSummary {
    profile: {
        avatar_url?: string;
        is_openly_joinable?: boolean;
        is_public?: boolean;
        long_description: string;
        name: string;
        short_description: string;
    };
    rooms_section: {
        rooms: unknown[];
        categories: Record<string, unknown>;
        total_room_count_estimate: number;
    };
    user: {
        is_privileged: boolean;
        is_public: boolean;
        is_publicised: boolean;
        membership: string;
    };
    users_section: {
        users: unknown[];
        roles: Record<string, unknown>;
        total_user_count_estimate: number;
    };
}
/* eslint-enable camelcase */

enum Progress {
    NotStarted,
    ValidatingInputs,
    FetchingData,
    CreatingSpace,
    InvitingUsers,
    // anything beyond here is inviting user n - 4
}

const CreateSpaceFromCommunityDialog: React.FC<IProps> = ({ matrixClient: cli, groupId, onFinished }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>(null);

    const [progress, setProgress] = useState(Progress.NotStarted);
    const [numInvites, setNumInvites] = useState(0);
    const busy = progress > 0;

    const [avatar, setAvatar] = useState<File>(null); // undefined means to remove avatar
    const [name, setName] = useState("");
    const spaceNameField = useRef<Field>();
    const [alias, setAlias] = useState("#" + groupId.substring(1, groupId.indexOf(":")) + ":" + cli.getDomain());
    const spaceAliasField = useRef<RoomAliasField>();
    const [topic, setTopic] = useState("");
    const [joinRule, setJoinRule] = useState<JoinRule>(JoinRule.Public);

    const groupSummary = useAsyncMemo<IGroupSummary>(() => cli.getGroupSummary(groupId), [groupId]);
    useEffect(() => {
        if (groupSummary) {
            setName(groupSummary.profile.name || "");
            setTopic(groupSummary.profile.short_description || "");
            setJoinRule(groupSummary.profile.is_openly_joinable ? JoinRule.Public : JoinRule.Invite);
            setLoading(false);
        }
    }, [groupSummary]);

    if (loading) {
        return <Spinner />;
    }

    const onCreateSpaceClick = async (e) => {
        e.preventDefault();
        if (busy) return;

        setError(null);
        setProgress(Progress.ValidatingInputs);

        // require & validate the space name field
        if (!(await spaceNameField.current.validate({ allowEmpty: false }))) {
            setProgress(0);
            spaceNameField.current.focus();
            spaceNameField.current.validate({ allowEmpty: false, focused: true });
            return;
        }
        // validate the space name alias field but do not require it
        if (joinRule === JoinRule.Public && !(await spaceAliasField.current.validate({ allowEmpty: true }))) {
            setProgress(0);
            spaceAliasField.current.focus();
            spaceAliasField.current.validate({ allowEmpty: true, focused: true });
            return;
        }

        try {
            setProgress(Progress.FetchingData);

            const [rooms, members, invitedMembers] = await Promise.all([
                cli.getGroupRooms(groupId).then(parseRoomsResponse) as Promise<IGroupRoom[]>,
                cli.getGroupUsers(groupId).then(parseMembersResponse) as Promise<GroupMember[]>,
                cli.getGroupInvitedUsers(groupId).then(parseMembersResponse) as Promise<GroupMember[]>,
            ]);

            setNumInvites(members.length + invitedMembers.length);

            const viaMap = new Map<string, string[]>();
            for (const { roomId, canonicalAlias } of rooms) {
                const room = cli.getRoom(roomId);
                if (room) {
                    viaMap.set(roomId, calculateRoomVia(room));
                } else if (canonicalAlias) {
                    try {
                        const { servers } = await cli.getRoomIdForAlias(canonicalAlias);
                        viaMap.set(roomId, servers);
                    } catch (e) {
                        logger.warn("Failed to resolve alias during community migration", e);
                    }
                }

                if (!viaMap.get(roomId)?.length) {
                    // XXX: lets guess the via, this might end up being incorrect.
                    const str = canonicalAlias || roomId;
                    viaMap.set(roomId, [str.substring(1, str.indexOf(":"))]);
                }
            }

            setProgress(Progress.CreatingSpace);

            const spaceAvatar = avatar !== undefined ? avatar : groupSummary.profile.avatar_url;
            const roomId = await createSpace(name, joinRule === JoinRule.Public, alias, topic, spaceAvatar, {
                creation_content: {
                    [CreateEventField]: groupId,
                },
                initial_state: rooms.map(({ roomId }) => ({
                    type: EventType.SpaceChild,
                    state_key: roomId,
                    content: {
                        via: viaMap.get(roomId) || [],
                    },
                })),
                // we do not specify the inviters here because Synapse applies a limit and this may cause it to trip
            }, {
                andView: false,
            });

            setProgress(Progress.InvitingUsers);

            const userIds = [...members, ...invitedMembers].map(m => m.userId).filter(m => m !== cli.getUserId());
            await inviteUsersToRoom(roomId, userIds, () => setProgress(p => p + 1));

            // eagerly remove it from the community panel
            dis.dispatch(TagOrderActions.removeTag(cli, groupId));

            // don't bother awaiting this, as we don't hugely care if it fails
            cli.setGroupProfile(groupId, {
                ...groupSummary.profile,
                long_description: `<a href="${makeRoomPermalink(roomId)}"><h1>` +
                    _t("This community has been upgraded into a Space") + `</h1></a><br />`
                    + groupSummary.profile.long_description,
            } as IGroupSummary["profile"]).catch(e => {
                logger.warn("Failed to update community profile during migration", e);
            });

            onFinished(roomId);

            const onSpaceClick = () => {
                dis.dispatch({
                    action: "view_room",
                    room_id: roomId,
                });
            };

            const onPreferencesClick = () => {
                dis.dispatch({
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Preferences,
                });
            };

            let spacesDisabledCopy;
            if (!SpaceStore.spacesEnabled) {
                spacesDisabledCopy = _t("To view Spaces, hide communities in <a>Preferences</a>", {}, {
                    a: sub => <AccessibleButton onClick={onPreferencesClick} kind="link">{ sub }</AccessibleButton>,
                });
            }

            Modal.createDialog(InfoDialog, {
                title: _t("Space created"),
                description: <>
                    <div className="mx_CreateSpaceFromCommunityDialog_SuccessInfoDialog_checkmark" />
                    <p>
                        { _t("<SpaceName/> has been made and everyone who was a part of the community has " +
                            "been invited to it.", {}, {
                            SpaceName: () => <AccessibleButton onClick={onSpaceClick} kind="link">
                                { name }
                            </AccessibleButton>,
                        }) }
                        &nbsp;
                        { spacesDisabledCopy }
                    </p>
                    <p>
                        { _t("To create a Space from another community, just pick the community in Preferences.") }
                    </p>
                </>,
                button: _t("Preferences"),
                onFinished: (openPreferences: boolean) => {
                    if (openPreferences) {
                        onPreferencesClick();
                    }
                },
            }, "mx_CreateSpaceFromCommunityDialog_SuccessInfoDialog");
        } catch (e) {
            logger.error(e);
            setError(e);
        }

        setProgress(Progress.NotStarted);
    };

    let footer;
    if (error) {
        footer = <>
            <img src={require("../../../../res/img/element-icons/warning-badge.svg")} height="24" width="24" alt="" />

            <span className="mx_CreateSpaceFromCommunityDialog_error">
                <div className="mx_CreateSpaceFromCommunityDialog_errorHeading">{ _t("Failed to migrate community") }</div>
                <div className="mx_CreateSpaceFromCommunityDialog_errorCaption">{ _t("Try again") }</div>
            </span>

            <AccessibleButton className="mx_CreateSpaceFromCommunityDialog_retryButton" onClick={onCreateSpaceClick}>
                { _t("Retry") }
            </AccessibleButton>
        </>;
    } else if (busy) {
        let description: string;
        switch (progress) {
            case Progress.ValidatingInputs:
            case Progress.FetchingData:
                description = _t("Fetching data...");
                break;
            case Progress.CreatingSpace:
                description = _t("Creating Space...");
                break;
            case Progress.InvitingUsers:
            default:
                description = _t("Adding rooms... (%(progress)s out of %(count)s)", {
                    count: numInvites,
                    progress,
                });
                break;
        }

        footer = <span>
            <ProgressBar
                value={progress > Progress.FetchingData ? progress : 0}
                max={numInvites + Progress.InvitingUsers}
            />
            <div className="mx_CreateSpaceFromCommunityDialog_progressText">
                { description }
            </div>
        </span>;
    } else {
        footer = <>
            <AccessibleButton kind="primary_outline" onClick={() => onFinished()}>
                { _t("Cancel") }
            </AccessibleButton>
            <AccessibleButton kind="primary" onClick={onCreateSpaceClick}>
                { _t("Create Space") }
            </AccessibleButton>
        </>;
    }

    return <BaseDialog
        title={_t("Create Space from community")}
        className="mx_CreateSpaceFromCommunityDialog"
        onFinished={onFinished}
        fixedWidth={false}
    >
        <div className="mx_CreateSpaceFromCommunityDialog_content">
            <p>
                { _t("A link to the Space will be put in your community description.") }
                &nbsp;
                { _t("All rooms will be added and all community members will be invited.") }
            </p>
            <p className="mx_CreateSpaceFromCommunityDialog_flairNotice">
                { _t("Flair won't be available in Spaces for the foreseeable future.") }
            </p>

            <SpaceCreateForm
                busy={busy}
                onSubmit={onCreateSpaceClick}
                avatarUrl={groupSummary.profile.avatar_url
                    ? mediaFromMxc(groupSummary.profile.avatar_url).getThumbnailOfSourceHttp(80, 80, "crop")
                    : undefined
                }
                setAvatar={setAvatar}
                name={name}
                setName={setName}
                nameFieldRef={spaceNameField}
                topic={topic}
                setTopic={setTopic}
                alias={alias}
                setAlias={setAlias}
                showAliasField={joinRule === JoinRule.Public}
                aliasFieldRef={spaceAliasField}
            >
                <p>{ _t("This description will be shown to people when they view your space") }</p>
                <JoinRuleDropdown
                    label={_t("Space visibility")}
                    labelInvite={_t("Private space (invite only)")}
                    labelPublic={_t("Public space")}
                    value={joinRule}
                    onChange={setJoinRule}
                />
                <p>{ joinRule === JoinRule.Public
                    ? _t("Open space for anyone, best for communities")
                    : _t("Invite only, best for yourself or teams")
                }</p>
                { joinRule !== JoinRule.Public &&
                    <div className="mx_CreateSpaceFromCommunityDialog_nonPublicSpacer" />
                }
            </SpaceCreateForm>
        </div>

        <div className="mx_CreateSpaceFromCommunityDialog_footer">
            { footer }
        </div>
    </BaseDialog>;
};

export default CreateSpaceFromCommunityDialog;

