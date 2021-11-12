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

import React, { RefObject, useContext, useRef, useState } from "react";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { JoinRule, Preset } from "matrix-js-sdk/src/@types/partials";
import { Room } from "matrix-js-sdk/src/models/room";
import { EventSubscription } from "fbemitter";

import MatrixClientContext from "../../contexts/MatrixClientContext";
import RoomAvatar from "../views/avatars/RoomAvatar";
import { _t } from "../../languageHandler";
import AccessibleButton from "../views/elements/AccessibleButton";
import RoomName from "../views/elements/RoomName";
import RoomTopic from "../views/elements/RoomTopic";
import InlineSpinner from "../views/elements/InlineSpinner";
import { inviteMultipleToRoom, showRoomInviteDialog } from "../../RoomInvite";
import { useRoomMembers } from "../../hooks/useRoomMembers";
import createRoom, { IOpts } from "../../createRoom";
import Field from "../views/elements/Field";
import { useEventEmitter } from "../../hooks/useEventEmitter";
import withValidation from "../views/elements/Validation";
import * as Email from "../../email";
import defaultDispatcher from "../../dispatcher/dispatcher";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import ResizeNotifier from "../../utils/ResizeNotifier";
import MainSplit from './MainSplit';
import ErrorBoundary from "../views/elements/ErrorBoundary";
import { ActionPayload } from "../../dispatcher/payloads";
import RightPanel from "./RightPanel";
import RightPanelStore from "../../stores/RightPanelStore";
import { RightPanelPhases } from "../../stores/RightPanelStorePhases";
import { SetRightPanelPhasePayload } from "../../dispatcher/payloads/SetRightPanelPhasePayload";
import { useStateArray } from "../../hooks/useStateArray";
import SpacePublicShare from "../views/spaces/SpacePublicShare";
import {
    shouldShowSpaceSettings,
    showAddExistingRooms,
    showCreateNewRoom,
    showCreateNewSubspace,
    showSpaceInvite,
    showSpaceSettings,
} from "../../utils/space";
import SpaceHierarchy, { showRoom } from "./SpaceHierarchy";
import MemberAvatar from "../views/avatars/MemberAvatar";
import SpaceStore from "../../stores/spaces/SpaceStore";
import FacePile from "../views/elements/FacePile";
import {
    AddExistingToSpace,
    defaultDmsRenderer,
    defaultRoomsRenderer,
    defaultSpacesRenderer,
} from "../views/dialogs/AddExistingToSpaceDialog";
import { ChevronFace, ContextMenuButton, useContextMenu } from "./ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../views/context_menus/IconizedContextMenu";
import AccessibleTooltipButton from "../views/elements/AccessibleTooltipButton";
import { BetaPill } from "../views/beta/BetaCard";
import { UserTab } from "../views/dialogs/UserSettingsDialog";
import { EffectiveMembership, getEffectiveMembership } from "../../utils/membership";
import { SpaceFeedbackPrompt } from "../views/spaces/SpaceCreateMenu";
import { CreateEventField, IGroupSummary } from "../views/dialogs/CreateSpaceFromCommunityDialog";
import { useAsyncMemo } from "../../hooks/useAsyncMemo";
import Spinner from "../views/elements/Spinner";
import GroupAvatar from "../views/avatars/GroupAvatar";
import { useDispatcher } from "../../hooks/useDispatcher";
import { useRoomState } from "../../hooks/useRoomState";

import { logger } from "matrix-js-sdk/src/logger";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import { UIComponent } from "../../settings/UIFeature";

interface IProps {
    space: Room;
    justCreatedOpts?: IOpts;
    resizeNotifier: ResizeNotifier;
    onJoinButtonClicked(): void;
    onRejectButtonClicked(): void;
}

interface IState {
    phase: Phase;
    firstRoomId?: string; // internal state for the creation wizard
    showRightPanel: boolean;
    myMembership: string;
}

enum Phase {
    Landing,
    PublicCreateRooms,
    PublicShare,
    PrivateScope,
    PrivateInvite,
    PrivateCreateRooms,
    PrivateExistingRooms,
}

const RoomMemberCount = ({ room, children }) => {
    const members = useRoomMembers(room);
    const count = members.length;

    if (children) return children(count);
    return count;
};

const useMyRoomMembership = (room: Room) => {
    const [membership, setMembership] = useState(room.getMyMembership());
    useEventEmitter(room, "Room.myMembership", () => {
        setMembership(room.getMyMembership());
    });
    return membership;
};

const SpaceInfo = ({ space }: { space: Room }) => {
    const summary = useAsyncMemo(async () => {
        if (space.getMyMembership() !== "invite") return;
        try {
            return space.client.getRoomSummary(space.roomId);
        } catch (e) {
            return null;
        }
    }, [space]);
    const joinRule = useRoomState(space, state => state.getJoinRule());
    const membership = useMyRoomMembership(space);

    let visibilitySection;
    if (joinRule === "public") {
        visibilitySection = <span className="mx_SpaceRoomView_info_public">
            { _t("Public space") }
        </span>;
    } else {
        visibilitySection = <span className="mx_SpaceRoomView_info_private">
            { _t("Private space") }
        </span>;
    }

    let memberSection;
    if (membership === "invite" && summary) {
        // Don't trust local state and instead use the summary API
        memberSection = <span className="mx_SpaceRoomView_info_memberCount">
            { _t("%(count)s members", { count: summary.num_joined_members }) }
        </span>;
    } else if (summary === null) {
        memberSection = <RoomMemberCount room={space}>
            { (count) => count > 0 ? (
                <AccessibleButton
                    kind="link"
                    className="mx_SpaceRoomView_info_memberCount"
                    onClick={() => {
                        defaultDispatcher.dispatch<SetRightPanelPhasePayload>({
                            action: Action.SetRightPanelPhase,
                            phase: RightPanelPhases.RoomMemberList,
                            refireParams: { space },
                        });
                    }}
                >
                    { _t("%(count)s members", { count }) }
                </AccessibleButton>
            ) : null }
        </RoomMemberCount>;
    }

    return <div className="mx_SpaceRoomView_info">
        { visibilitySection }
        { memberSection }
    </div>;
};

const onPreferencesClick = () => {
    defaultDispatcher.dispatch({
        action: Action.ViewUserSettings,
        initialTabId: UserTab.Preferences,
    });
};

// XXX: temporary community migration component
const GroupTile = ({ groupId }: { groupId: string }) => {
    const cli = useContext(MatrixClientContext);
    const groupSummary = useAsyncMemo<IGroupSummary>(() => cli.getGroupSummary(groupId), [cli, groupId]);

    if (!groupSummary) return <Spinner />;

    return <>
        <GroupAvatar
            groupId={groupId}
            groupName={groupSummary.profile.name}
            groupAvatarUrl={groupSummary.profile.avatar_url}
            width={16}
            height={16}
            resizeMethod='crop'
        />
        { groupSummary.profile.name }
    </>;
};

interface ISpacePreviewProps {
    space: Room;
    onJoinButtonClicked(): void;
    onRejectButtonClicked(): void;
}

const SpacePreview = ({ space, onJoinButtonClicked, onRejectButtonClicked }: ISpacePreviewProps) => {
    const cli = useContext(MatrixClientContext);
    const myMembership = useMyRoomMembership(space);
    useDispatcher(defaultDispatcher, payload => {
        if (payload.action === Action.JoinRoomError && payload.roomId === space.roomId) {
            setBusy(false); // stop the spinner, join failed
        }
    });

    const [busy, setBusy] = useState(false);

    const spacesEnabled = SpaceStore.spacesEnabled;

    const joinRule = useRoomState(space, state => state.getJoinRule());
    const cannotJoin = getEffectiveMembership(myMembership) === EffectiveMembership.Leave
        && joinRule !== JoinRule.Public;

    let inviterSection;
    let joinButtons;
    if (myMembership === "join") {
        // XXX remove this when spaces leaves Beta
        joinButtons = (
            <AccessibleButton
                kind="danger_outline"
                onClick={() => {
                    dis.dispatch({
                        action: "leave_room",
                        room_id: space.roomId,
                    });
                }}
            >
                { _t("Leave") }
            </AccessibleButton>
        );
    } else if (myMembership === "invite") {
        const inviteSender = space.getMember(cli.getUserId())?.events.member?.getSender();
        const inviter = inviteSender && space.getMember(inviteSender);

        if (inviteSender) {
            inviterSection = <div className="mx_SpaceRoomView_preview_inviter">
                <MemberAvatar member={inviter} fallbackUserId={inviteSender} width={32} height={32} />
                <div>
                    <div className="mx_SpaceRoomView_preview_inviter_name">
                        { _t("<inviter/> invites you", {}, {
                            inviter: () => <b>{ inviter?.name || inviteSender }</b>,
                        }) }
                    </div>
                    { inviter ? <div className="mx_SpaceRoomView_preview_inviter_mxid">
                        { inviteSender }
                    </div> : null }
                </div>
            </div>;
        }

        joinButtons = <>
            <AccessibleButton
                kind="secondary"
                onClick={() => {
                    setBusy(true);
                    onRejectButtonClicked();
                }}
            >
                { _t("Reject") }
            </AccessibleButton>
            <AccessibleButton
                kind="primary"
                onClick={() => {
                    setBusy(true);
                    onJoinButtonClicked();
                }}
                disabled={!spacesEnabled}
            >
                { _t("Accept") }
            </AccessibleButton>
        </>;
    } else {
        joinButtons = (
            <AccessibleButton
                kind="primary"
                onClick={() => {
                    onJoinButtonClicked();
                    if (!cli.isGuest()) {
                        // user will be shown a modal that won't fire a room join error
                        setBusy(true);
                    }
                }}
                disabled={!spacesEnabled || cannotJoin}
            >
                { _t("Join") }
            </AccessibleButton>
        );
    }

    if (busy) {
        joinButtons = <InlineSpinner />;
    }

    let footer;
    if (!spacesEnabled) {
        footer = <div className="mx_SpaceRoomView_preview_spaceBetaPrompt">
            { myMembership === "join"
                ? _t("To view this Space, hide communities in your <a>preferences</a>", {}, {
                    a: sub => <AccessibleButton onClick={onPreferencesClick} kind="link">{ sub }</AccessibleButton>,
                })
                : _t("To join this Space, hide communities in your <a>preferences</a>", {}, {
                    a: sub => <AccessibleButton onClick={onPreferencesClick} kind="link">{ sub }</AccessibleButton>,
                })
            }
        </div>;
    } else if (cannotJoin) {
        footer = <div className="mx_SpaceRoomView_preview_spaceBetaPrompt">
            { _t("To view %(spaceName)s, you need an invite", {
                spaceName: space.name,
            }) }
        </div>;
    }

    let migratedCommunitySection: JSX.Element;
    const createContent = space.currentState.getStateEvents(EventType.RoomCreate, "")?.getContent();
    if (createContent[CreateEventField]) {
        migratedCommunitySection = <div className="mx_SpaceRoomView_preview_migratedCommunity">
            { _t("Created from <Community />", {}, {
                Community: () => <GroupTile groupId={createContent[CreateEventField]} />,
            }) }
        </div>;
    }

    return <div className="mx_SpaceRoomView_preview">
        { migratedCommunitySection }
        { inviterSection }
        <RoomAvatar room={space} height={80} width={80} viewAvatarOnClick={true} />
        <h1 className="mx_SpaceRoomView_preview_name">
            <RoomName room={space} />
        </h1>
        <SpaceInfo space={space} />
        <RoomTopic room={space}>
            { (topic, ref) =>
                <div className="mx_SpaceRoomView_preview_topic" ref={ref}>
                    { topic }
                </div>
            }
        </RoomTopic>
        { space.getJoinRule() === "public" && <FacePile room={space} /> }
        <div className="mx_SpaceRoomView_preview_joinButtons">
            { joinButtons }
        </div>
        { footer }
    </div>;
};

const SpaceLandingAddButton = ({ space }) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu();

    let contextMenu;
    if (menuDisplayed) {
        const rect = handle.current.getBoundingClientRect();
        contextMenu = <IconizedContextMenu
            left={rect.left + window.pageXOffset + 0}
            top={rect.bottom + window.pageYOffset + 8}
            chevronFace={ChevronFace.None}
            onFinished={closeMenu}
            className="mx_RoomTile_contextMenu"
            compact
        >
            <IconizedContextMenuOptionList first>
                <IconizedContextMenuOption
                    label={_t("Create new room")}
                    iconClassName="mx_RoomList_iconPlus"
                    onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeMenu();

                        if (await showCreateNewRoom(space)) {
                            defaultDispatcher.fire(Action.UpdateSpaceHierarchy);
                        }
                    }}
                />
                <IconizedContextMenuOption
                    label={_t("Add existing room")}
                    iconClassName="mx_RoomList_iconHash"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeMenu();
                        showAddExistingRooms(space);
                    }}
                />
                <IconizedContextMenuOption
                    label={_t("Add space")}
                    iconClassName="mx_RoomList_iconPlus"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeMenu();
                        showCreateNewSubspace(space);
                    }}
                >
                    <BetaPill />
                </IconizedContextMenuOption>
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>;
    }

    return <>
        <ContextMenuButton
            kind="primary"
            inputRef={handle}
            onClick={openMenu}
            isExpanded={menuDisplayed}
            label={_t("Add")}
        >
            { _t("Add") }
        </ContextMenuButton>
        { contextMenu }
    </>;
};

const SpaceLanding = ({ space }: { space: Room }) => {
    const cli = useContext(MatrixClientContext);
    const myMembership = useMyRoomMembership(space);
    const userId = cli.getUserId();

    let inviteButton;
    if (((myMembership === "join" && space.canInvite(userId)) || space.getJoinRule() === JoinRule.Public) &&
        shouldShowComponent(UIComponent.InviteUsers)
    ) {
        inviteButton = (
            <AccessibleButton
                kind="primary"
                className="mx_SpaceRoomView_landing_inviteButton"
                onClick={() => {
                    showSpaceInvite(space);
                }}
            >
                { _t("Invite") }
            </AccessibleButton>
        );
    }

    const canAddRooms = myMembership === "join" && space.currentState.maySendStateEvent(EventType.SpaceChild, userId);

    let addRoomButton;
    if (canAddRooms) {
        addRoomButton = <SpaceLandingAddButton space={space} />;
    }

    let settingsButton;
    if (shouldShowSpaceSettings(space)) {
        settingsButton = <AccessibleTooltipButton
            className="mx_SpaceRoomView_landing_settingsButton"
            onClick={() => {
                showSpaceSettings(space);
            }}
            title={_t("Settings")}
        />;
    }

    const onMembersClick = () => {
        defaultDispatcher.dispatch<SetRightPanelPhasePayload>({
            action: Action.SetRightPanelPhase,
            phase: RightPanelPhases.RoomMemberList,
            refireParams: { space },
        });
    };

    return <div className="mx_SpaceRoomView_landing">
        <SpaceFeedbackPrompt />
        <RoomAvatar room={space} height={80} width={80} viewAvatarOnClick={true} />
        <div className="mx_SpaceRoomView_landing_name">
            <RoomName room={space}>
                { (name) => {
                    const tags = { name: () => <div className="mx_SpaceRoomView_landing_nameRow">
                        <h1>{ name }</h1>
                    </div> };
                    return _t("Welcome to <name/>", {}, tags) as JSX.Element;
                } }
            </RoomName>
        </div>
        <div className="mx_SpaceRoomView_landing_info">
            <SpaceInfo space={space} />
            <FacePile room={space} onlyKnownUsers={false} numShown={7} onClick={onMembersClick} />
            { inviteButton }
            { settingsButton }
        </div>
        <RoomTopic room={space}>
            { (topic, ref) => (
                <div className="mx_SpaceRoomView_landing_topic" ref={ref}>
                    { topic }
                </div>
            ) }
        </RoomTopic>

        <SpaceHierarchy space={space} showRoom={showRoom} additionalButtons={addRoomButton} />
    </div>;
};

const SpaceSetupFirstRooms = ({ space, title, description, onFinished }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const numFields = 3;
    const placeholders = [_t("General"), _t("Random"), _t("Support")];
    const [roomNames, setRoomName] = useStateArray(numFields, [_t("General"), _t("Random"), ""]);
    const fields = new Array(numFields).fill(0).map((x, i) => {
        const name = "roomName" + i;
        return <Field
            key={name}
            name={name}
            type="text"
            label={_t("Room name")}
            placeholder={placeholders[i]}
            value={roomNames[i]}
            onChange={ev => setRoomName(i, ev.target.value)}
            autoFocus={i === 2}
            disabled={busy}
            autoComplete="off"
        />;
    });

    const onNextClick = async (ev) => {
        ev.preventDefault();
        if (busy) return;
        setError("");
        setBusy(true);
        try {
            const isPublic = space.getJoinRule() === JoinRule.Public;
            const filteredRoomNames = roomNames.map(name => name.trim()).filter(Boolean);
            const roomIds = await Promise.all(filteredRoomNames.map(name => {
                return createRoom({
                    createOpts: {
                        preset: isPublic ? Preset.PublicChat : Preset.PrivateChat,
                        name,
                    },
                    spinner: false,
                    encryption: false,
                    andView: false,
                    inlineErrors: true,
                    parentSpace: space,
                    joinRule: !isPublic ? JoinRule.Restricted : undefined,
                    suggested: true,
                });
            }));
            onFinished(roomIds[0]);
        } catch (e) {
            logger.error("Failed to create initial space rooms", e);
            setError(_t("Failed to create initial space rooms"));
        }
        setBusy(false);
    };

    let onClick = (ev) => {
        ev.preventDefault();
        onFinished();
    };
    let buttonLabel = _t("Skip for now");
    if (roomNames.some(name => name.trim())) {
        onClick = onNextClick;
        buttonLabel = busy ? _t("Creating rooms...") : _t("Continue");
    }

    return <div>
        <h1>{ title }</h1>
        <div className="mx_SpaceRoomView_description">{ description }</div>

        { error && <div className="mx_SpaceRoomView_errorText">{ error }</div> }
        <form onSubmit={onClick} id="mx_SpaceSetupFirstRooms">
            { fields }
        </form>

        <div className="mx_SpaceRoomView_buttons">
            <AccessibleButton
                kind="primary"
                disabled={busy}
                onClick={onClick}
                element="input"
                type="submit"
                form="mx_SpaceSetupFirstRooms"
                value={buttonLabel}
            />
        </div>
    </div>;
};

const SpaceAddExistingRooms = ({ space, onFinished }) => {
    return <div>
        <h1>{ _t("What do you want to organise?") }</h1>
        <div className="mx_SpaceRoomView_description">
            { _t("Pick rooms or conversations to add. This is just a space for you, " +
                "no one will be informed. You can add more later.") }
        </div>

        <AddExistingToSpace
            space={space}
            emptySelectionButton={
                <AccessibleButton kind="primary" onClick={onFinished}>
                    { _t("Skip for now") }
                </AccessibleButton>
            }
            filterPlaceholder={_t("Search for rooms or spaces")}
            onFinished={onFinished}
            roomsRenderer={defaultRoomsRenderer}
            spacesRenderer={defaultSpacesRenderer}
            dmsRenderer={defaultDmsRenderer}
        />
    </div>;
};

interface ISpaceSetupPublicShareProps extends Pick<IProps & IState, "justCreatedOpts" | "space" | "firstRoomId"> {
    onFinished(): void;
}

const SpaceSetupPublicShare = ({ justCreatedOpts, space, onFinished, firstRoomId }: ISpaceSetupPublicShareProps) => {
    return <div className="mx_SpaceRoomView_publicShare">
        <h1>{ _t("Share %(name)s", {
            name: justCreatedOpts?.createOpts?.name || space.name,
        }) }</h1>
        <div className="mx_SpaceRoomView_description">
            { _t("It's just you at the moment, it will be even better with others.") }
        </div>

        <SpacePublicShare space={space} />

        <div className="mx_SpaceRoomView_buttons">
            <AccessibleButton kind="primary" onClick={onFinished}>
                { firstRoomId ? _t("Go to my first room") : _t("Go to my space") }
            </AccessibleButton>
        </div>
    </div>;
};

const SpaceSetupPrivateScope = ({ space, justCreatedOpts, onFinished }) => {
    return <div className="mx_SpaceRoomView_privateScope">
        <h1>{ _t("Who are you working with?") }</h1>
        <div className="mx_SpaceRoomView_description">
            { _t("Make sure the right people have access to %(name)s", {
                name: justCreatedOpts?.createOpts?.name || space.name,
            }) }
        </div>

        <AccessibleButton
            className="mx_SpaceRoomView_privateScope_justMeButton"
            onClick={() => { onFinished(false); }}
        >
            <h3>{ _t("Just me") }</h3>
            <div>{ _t("A private space to organise your rooms") }</div>
        </AccessibleButton>
        <AccessibleButton
            className="mx_SpaceRoomView_privateScope_meAndMyTeammatesButton"
            onClick={() => { onFinished(true); }}
        >
            <h3>{ _t("Me and my teammates") }</h3>
            <div>{ _t("A private space for you and your teammates") }</div>
        </AccessibleButton>
    </div>;
};

const validateEmailRules = withValidation({
    rules: [{
        key: "email",
        test: ({ value }) => !value || Email.looksValid(value),
        invalid: () => _t("Doesn't look like a valid email address"),
    }],
});

const SpaceSetupPrivateInvite = ({ space, onFinished }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const numFields = 3;
    const fieldRefs: RefObject<Field>[] = [useRef(), useRef(), useRef()];
    const [emailAddresses, setEmailAddress] = useStateArray(numFields, "");
    const fields = new Array(numFields).fill(0).map((x, i) => {
        const name = "emailAddress" + i;
        return <Field
            key={name}
            name={name}
            type="text"
            label={_t("Email address")}
            placeholder={_t("Email")}
            value={emailAddresses[i]}
            onChange={ev => setEmailAddress(i, ev.target.value)}
            ref={fieldRefs[i]}
            onValidate={validateEmailRules}
            autoFocus={i === 0}
            disabled={busy}
        />;
    });

    const onNextClick = async (ev) => {
        ev.preventDefault();
        if (busy) return;
        setError("");
        for (let i = 0; i < fieldRefs.length; i++) {
            const fieldRef = fieldRefs[i];
            const valid = await fieldRef.current.validate({ allowEmpty: true });

            if (valid === false) { // true/null are allowed
                fieldRef.current.focus();
                fieldRef.current.validate({ allowEmpty: true, focused: true });
                return;
            }
        }

        setBusy(true);
        const targetIds = emailAddresses.map(name => name.trim()).filter(Boolean);
        try {
            const result = await inviteMultipleToRoom(space.roomId, targetIds);

            const failedUsers = Object.keys(result.states).filter(a => result.states[a] === "error");
            if (failedUsers.length > 0) {
                logger.log("Failed to invite users to space: ", result);
                setError(_t("Failed to invite the following users to your space: %(csvUsers)s", {
                    csvUsers: failedUsers.join(", "),
                }));
            } else {
                onFinished();
            }
        } catch (err) {
            logger.error("Failed to invite users to space: ", err);
            setError(_t("We couldn't invite those users. Please check the users you want to invite and try again."));
        }
        setBusy(false);
    };

    let onClick = (ev) => {
        ev.preventDefault();
        onFinished();
    };
    let buttonLabel = _t("Skip for now");
    if (emailAddresses.some(name => name.trim())) {
        onClick = onNextClick;
        buttonLabel = busy ? _t("Inviting...") : _t("Continue");
    }

    return <div className="mx_SpaceRoomView_inviteTeammates">
        <h1>{ _t("Invite your teammates") }</h1>
        <div className="mx_SpaceRoomView_description">
            { _t("Make sure the right people have access. You can invite more later.") }
        </div>

        <div className="mx_SpaceRoomView_inviteTeammates_betaDisclaimer">
            { _t("<b>This is an experimental feature.</b> For now, " +
                "new users receiving an invite will have to open the invite on <link/> to actually join.", {}, {
                b: sub => <b>{ sub }</b>,
                link: () => <a href="https://app.element.io/" rel="noreferrer noopener" target="_blank">
                    app.element.io
                </a>,
            }) }
        </div>

        { error && <div className="mx_SpaceRoomView_errorText">{ error }</div> }
        <form onSubmit={onClick} id="mx_SpaceSetupPrivateInvite">
            { fields }
        </form>

        <div className="mx_SpaceRoomView_inviteTeammates_buttons">
            <AccessibleButton
                className="mx_SpaceRoomView_inviteTeammates_inviteDialogButton"
                onClick={() => showRoomInviteDialog(space.roomId)}
            >
                { _t("Invite by username") }
            </AccessibleButton>
        </div>

        <div className="mx_SpaceRoomView_buttons">
            <AccessibleButton
                kind="primary"
                disabled={busy}
                onClick={onClick}
                element="input"
                type="submit"
                form="mx_SpaceSetupPrivateInvite"
                value={buttonLabel}
            />
        </div>
    </div>;
};

export default class SpaceRoomView extends React.PureComponent<IProps, IState> {
    static contextType = MatrixClientContext;

    private readonly creator: string;
    private readonly dispatcherRef: string;
    private readonly rightPanelStoreToken: EventSubscription;

    constructor(props, context) {
        super(props, context);

        let phase = Phase.Landing;

        this.creator = this.props.space.currentState.getStateEvents(EventType.RoomCreate, "")?.getSender();
        const showSetup = this.props.justCreatedOpts && this.context.getUserId() === this.creator;

        if (showSetup) {
            phase = this.props.justCreatedOpts.createOpts.preset === Preset.PublicChat
                ? Phase.PublicCreateRooms : Phase.PrivateScope;
        }

        this.state = {
            phase,
            showRightPanel: RightPanelStore.getSharedInstance().isOpenForRoom,
            myMembership: this.props.space.getMyMembership(),
        };

        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        this.rightPanelStoreToken = RightPanelStore.getSharedInstance().addListener(this.onRightPanelStoreUpdate);
        this.context.on("Room.myMembership", this.onMyMembership);
    }

    componentWillUnmount() {
        defaultDispatcher.unregister(this.dispatcherRef);
        this.rightPanelStoreToken.remove();
        this.context.off("Room.myMembership", this.onMyMembership);
    }

    private onMyMembership = (room: Room, myMembership: string) => {
        if (room.roomId === this.props.space.roomId) {
            this.setState({ myMembership });
        }
    };

    private onRightPanelStoreUpdate = () => {
        this.setState({
            showRightPanel: RightPanelStore.getSharedInstance().isOpenForRoom,
        });
    };

    private onAction = (payload: ActionPayload) => {
        if (payload.action === "view_room" && payload.room_id === this.props.space.roomId) {
            this.setState({ phase: Phase.Landing });
            return;
        }

        if (payload.action !== Action.ViewUser && payload.action !== "view_3pid_invite") return;

        if (payload.action === Action.ViewUser && payload.member) {
            defaultDispatcher.dispatch<SetRightPanelPhasePayload>({
                action: Action.SetRightPanelPhase,
                phase: RightPanelPhases.SpaceMemberInfo,
                refireParams: {
                    space: this.props.space,
                    member: payload.member,
                },
            });
        } else if (payload.action === "view_3pid_invite" && payload.event) {
            defaultDispatcher.dispatch<SetRightPanelPhasePayload>({
                action: Action.SetRightPanelPhase,
                phase: RightPanelPhases.Space3pidMemberInfo,
                refireParams: {
                    space: this.props.space,
                    event: payload.event,
                },
            });
        } else {
            defaultDispatcher.dispatch<SetRightPanelPhasePayload>({
                action: Action.SetRightPanelPhase,
                phase: RightPanelPhases.SpaceMemberList,
                refireParams: { space: this.props.space },
            });
        }
    };

    private goToFirstRoom = async () => {
        if (this.state.firstRoomId) {
            defaultDispatcher.dispatch({
                action: "view_room",
                room_id: this.state.firstRoomId,
            });
            return;
        }

        this.setState({ phase: Phase.Landing });
    };

    private renderBody() {
        switch (this.state.phase) {
            case Phase.Landing:
                if (this.state.myMembership === "join" && SpaceStore.spacesEnabled) {
                    return <SpaceLanding space={this.props.space} />;
                } else {
                    return <SpacePreview
                        space={this.props.space}
                        onJoinButtonClicked={this.props.onJoinButtonClicked}
                        onRejectButtonClicked={this.props.onRejectButtonClicked}
                    />;
                }
            case Phase.PublicCreateRooms:
                return <SpaceSetupFirstRooms
                    space={this.props.space}
                    title={_t("What are some things you want to discuss in %(spaceName)s?", {
                        spaceName: this.props.justCreatedOpts?.createOpts?.name || this.props.space.name,
                    })}
                    description={
                        _t("Let's create a room for each of them.") + "\n" +
                        _t("You can add more later too, including already existing ones.")
                    }
                    onFinished={(firstRoomId: string) => this.setState({ phase: Phase.PublicShare, firstRoomId })}
                />;
            case Phase.PublicShare:
                return <SpaceSetupPublicShare
                    justCreatedOpts={this.props.justCreatedOpts}
                    space={this.props.space}
                    onFinished={this.goToFirstRoom}
                    firstRoomId={this.state.firstRoomId}
                />;

            case Phase.PrivateScope:
                return <SpaceSetupPrivateScope
                    space={this.props.space}
                    justCreatedOpts={this.props.justCreatedOpts}
                    onFinished={(invite: boolean) => {
                        this.setState({ phase: invite ? Phase.PrivateCreateRooms : Phase.PrivateExistingRooms });
                    }}
                />;
            case Phase.PrivateInvite:
                return <SpaceSetupPrivateInvite
                    space={this.props.space}
                    onFinished={() => this.setState({ phase: Phase.Landing })}
                />;
            case Phase.PrivateCreateRooms:
                return <SpaceSetupFirstRooms
                    space={this.props.space}
                    title={_t("What projects are your team working on?")}
                    description={_t("We'll create rooms for each of them. " +
                        "You can add more later too, including already existing ones.")}
                    onFinished={(firstRoomId: string) => this.setState({ phase: Phase.PrivateInvite, firstRoomId })}
                />;
            case Phase.PrivateExistingRooms:
                return <SpaceAddExistingRooms
                    space={this.props.space}
                    onFinished={() => this.setState({ phase: Phase.Landing })}
                />;
        }
    }

    render() {
        const rightPanel = this.state.showRightPanel && this.state.phase === Phase.Landing
            ? <RightPanel room={this.props.space} resizeNotifier={this.props.resizeNotifier} />
            : null;

        return <main className="mx_SpaceRoomView">
            <ErrorBoundary>
                <MainSplit panel={rightPanel} resizeNotifier={this.props.resizeNotifier}>
                    { this.renderBody() }
                </MainSplit>
            </ErrorBoundary>
        </main>;
    }
}
