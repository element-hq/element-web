/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, RoomType, JoinRule, Preset, type Room, RoomEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";
import React, { type JSX, useCallback, useContext, useRef, useState } from "react";

import MatrixClientContext from "../../contexts/MatrixClientContext";
import createRoom, { type IOpts } from "../../createRoom";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import { Action } from "../../dispatcher/actions";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ActionPayload } from "../../dispatcher/payloads";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import * as Email from "../../email";
import { useEventEmitterState } from "../../hooks/useEventEmitter";
import { useMyRoomMembership } from "../../hooks/useRoomMembers";
import { useFeatureEnabled } from "../../hooks/useSettings";
import { useStateArray } from "../../hooks/useStateArray";
import { _t } from "../../languageHandler";
import PosthogTrackers from "../../PosthogTrackers";
import { inviteMultipleToRoom, showRoomInviteDialog } from "../../RoomInvite";
import { UIComponent } from "../../settings/UIFeature";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import RightPanelStore from "../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import {
    shouldShowSpaceInvite,
    shouldShowSpaceSettings,
    showAddExistingRooms,
    showCreateNewRoom,
    showCreateNewSubspace,
    showSpaceInvite,
    showSpaceSettings,
} from "../../utils/space";
import RoomAvatar from "../views/avatars/RoomAvatar";
import { BetaPill } from "../views/beta/BetaCard";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../views/context_menus/IconizedContextMenu";
import {
    AddExistingToSpace,
    defaultDmsRenderer,
    defaultRoomsRenderer,
} from "../views/dialogs/AddExistingToSpaceDialog";
import AccessibleButton, { type ButtonEvent } from "../views/elements/AccessibleButton";
import ErrorBoundary from "../views/elements/ErrorBoundary";
import Field from "../views/elements/Field";
import RoomFacePile from "../views/elements/RoomFacePile";
import RoomName from "../views/elements/RoomName";
import RoomTopic from "../views/elements/RoomTopic";
import withValidation from "../views/elements/Validation";
import RoomInfoLine from "../views/rooms/RoomInfoLine";
import RoomPreviewCard from "../views/rooms/RoomPreviewCard";
import SpacePublicShare from "../views/spaces/SpacePublicShare";
import { ChevronFace, ContextMenuButton, useContextMenu } from "./ContextMenu";
import MainSplit from "./MainSplit";
import RightPanel from "./RightPanel";
import SpaceHierarchy, { showRoom } from "./SpaceHierarchy";
import { type RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";

interface IProps {
    space: Room;
    justCreatedOpts?: IOpts;
    resizeNotifier: ResizeNotifier;
    permalinkCreator: RoomPermalinkCreator;
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

const SpaceLandingAddButton: React.FC<{ space: Room }> = ({ space }) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu();
    const canCreateRoom = shouldShowComponent(UIComponent.CreateRooms);
    const canCreateSpace = shouldShowComponent(UIComponent.CreateSpaces);
    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms");

    let contextMenu: JSX.Element | null = null;
    if (menuDisplayed) {
        const rect = handle.current!.getBoundingClientRect();
        contextMenu = (
            <IconizedContextMenu
                left={rect.left + window.scrollX + 0}
                top={rect.bottom + window.scrollY + 8}
                chevronFace={ChevronFace.None}
                onFinished={closeMenu}
                className="mx_RoomTile_contextMenu"
                compact
            >
                <IconizedContextMenuOptionList first>
                    {canCreateRoom && (
                        <>
                            <IconizedContextMenuOption
                                label={_t("action|new_room")}
                                iconClassName="mx_LegacyRoomList_iconNewRoom"
                                onClick={async (e): Promise<void> => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeMenu();

                                    PosthogTrackers.trackInteraction("WebSpaceHomeCreateRoomButton", e);
                                    if (await showCreateNewRoom(space)) {
                                        defaultDispatcher.fire(Action.UpdateSpaceHierarchy);
                                    }
                                }}
                            />
                            {videoRoomsEnabled && (
                                <IconizedContextMenuOption
                                    label={_t("action|new_video_room")}
                                    iconClassName="mx_LegacyRoomList_iconNewVideoRoom"
                                    onClick={async (e): Promise<void> => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        closeMenu();

                                        if (
                                            await showCreateNewRoom(
                                                space,
                                                elementCallVideoRoomsEnabled
                                                    ? RoomType.UnstableCall
                                                    : RoomType.ElementVideo,
                                            )
                                        ) {
                                            defaultDispatcher.fire(Action.UpdateSpaceHierarchy);
                                        }
                                    }}
                                >
                                    <BetaPill />
                                </IconizedContextMenuOption>
                            )}
                        </>
                    )}
                    <IconizedContextMenuOption
                        label={_t("action|add_existing_room")}
                        iconClassName="mx_LegacyRoomList_iconAddExistingRoom"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            closeMenu();
                            showAddExistingRooms(space);
                        }}
                    />
                    {canCreateSpace && (
                        <IconizedContextMenuOption
                            label={_t("room_list|add_space_label")}
                            iconClassName="mx_LegacyRoomList_iconPlus"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                closeMenu();
                                showCreateNewSubspace(space);
                            }}
                        >
                            <BetaPill />
                        </IconizedContextMenuOption>
                    )}
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>
        );
    }

    return (
        <>
            <ContextMenuButton
                kind="primary"
                ref={handle}
                onClick={openMenu}
                isExpanded={menuDisplayed}
                label={_t("action|add")}
            >
                {_t("action|add")}
            </ContextMenuButton>
            {contextMenu}
        </>
    );
};

const SpaceLanding: React.FC<{ space: Room }> = ({ space }) => {
    const cli = useContext(MatrixClientContext);
    const myMembership = useMyRoomMembership(space);
    const userId = cli.getSafeUserId();

    const storeIsShowingSpaceMembers = useCallback(
        () =>
            RightPanelStore.instance.isOpenForRoom(space.roomId) &&
            RightPanelStore.instance.currentCardForRoom(space.roomId)?.phase === RightPanelPhases.MemberList,
        [space.roomId],
    );
    const isShowingMembers = useEventEmitterState(RightPanelStore.instance, UPDATE_EVENT, storeIsShowingSpaceMembers);

    let inviteButton;
    if (shouldShowSpaceInvite(space) && shouldShowComponent(UIComponent.InviteUsers)) {
        inviteButton = (
            <AccessibleButton
                kind="primary"
                className="mx_SpaceRoomView_landing_inviteButton"
                onClick={() => {
                    showSpaceInvite(space);
                }}
            >
                {_t("action|invite")}
            </AccessibleButton>
        );
    }

    const hasAddRoomPermissions =
        myMembership === KnownMembership.Join && space.currentState.maySendStateEvent(EventType.SpaceChild, userId);

    let addRoomButton;
    if (hasAddRoomPermissions) {
        addRoomButton = <SpaceLandingAddButton space={space} />;
    }

    let settingsButton;
    if (shouldShowSpaceSettings(space)) {
        settingsButton = (
            <AccessibleButton
                className="mx_SpaceRoomView_landing_settingsButton"
                onClick={() => {
                    showSpaceSettings(space);
                }}
                title={_t("common|settings")}
                placement="bottom"
            />
        );
    }

    const onMembersClick = (): void => {
        RightPanelStore.instance.setCard({ phase: RightPanelPhases.MemberList });
    };

    return (
        <div className="mx_SpaceRoomView_landing">
            <div className="mx_SpaceRoomView_landing_header">
                <RoomAvatar room={space} size="80px" viewAvatarOnClick={true} type="square" />
            </div>
            <div className="mx_SpaceRoomView_landing_name">
                <RoomName room={space}>
                    {(name) => {
                        const tags = { name: () => <h1>{name}</h1> };
                        return _t("space|landing_welcome", {}, tags) as JSX.Element;
                    }}
                </RoomName>
            </div>
            <div className="mx_SpaceRoomView_landing_infoBar">
                <RoomInfoLine room={space} />
                <div className="mx_SpaceRoomView_landing_infoBar_interactive">
                    <RoomFacePile
                        room={space}
                        onlyKnownUsers={false}
                        numShown={7}
                        onClick={isShowingMembers ? undefined : onMembersClick}
                    />
                    {inviteButton}
                    {settingsButton}
                </div>
            </div>
            <RoomTopic room={space} className="mx_SpaceRoomView_landing_topic" />

            <SpaceHierarchy space={space} showRoom={showRoom} additionalButtons={addRoomButton} />
        </div>
    );
};

const SpaceSetupFirstRooms: React.FC<{
    space: Room;
    title: string;
    description: JSX.Element;
    onFinished(firstRoomId?: string): void;
}> = ({ space, title, description, onFinished }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const numFields = 3;
    const placeholders = [_t("common|general"), _t("common|random"), _t("common|support")];
    const [roomNames, setRoomName] = useStateArray(numFields, [_t("common|general"), _t("common|random"), ""]);
    const fields = new Array(numFields).fill(0).map((x, i) => {
        const name = "roomName" + i;
        return (
            <Field
                key={name}
                name={name}
                type="text"
                label={_t("common|room_name")}
                placeholder={placeholders[i]}
                value={roomNames[i]}
                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setRoomName(i, ev.target.value)}
                autoFocus={i === 2}
                disabled={busy}
                autoComplete="off"
            />
        );
    });

    const onNextClick = async (ev: ButtonEvent): Promise<void> => {
        ev.preventDefault();
        if (busy) return;
        setError("");
        setBusy(true);
        try {
            const isPublic = space.getJoinRule() === JoinRule.Public;
            const filteredRoomNames = roomNames.map((name) => name.trim()).filter(Boolean);
            const roomIds = await Promise.all(
                filteredRoomNames.map((name) => {
                    return createRoom(space.client, {
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
                }),
            );
            onFinished(roomIds[0] ?? undefined);
        } catch (e) {
            logger.error("Failed to create initial space rooms", e);
            setError(_t("create_space|failed_create_initial_rooms"));
        }
        setBusy(false);
    };

    let onClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        onFinished();
    };
    let buttonLabel = _t("create_space|skip_action");
    if (roomNames.some((name) => name.trim())) {
        onClick = onNextClick;
        buttonLabel = busy ? _t("create_space|creating_rooms") : _t("action|continue");
    }

    return (
        <div>
            <h1>{title}</h1>
            <div className="mx_SpaceRoomView_description">{description}</div>

            {error && <div className="mx_SpaceRoomView_errorText">{error}</div>}
            <form onSubmit={onClick} id="mx_SpaceSetupFirstRooms">
                {fields}
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
        </div>
    );
};

const SpaceAddExistingRooms: React.FC<{
    space: Room;
    onFinished(): void;
}> = ({ space, onFinished }) => {
    return (
        <div>
            <h1>{_t("create_space|add_existing_rooms_heading")}</h1>
            <div className="mx_SpaceRoomView_description">{_t("create_space|add_existing_rooms_description")}</div>

            <AddExistingToSpace
                space={space}
                emptySelectionButton={
                    <AccessibleButton kind="primary" onClick={onFinished}>
                        {_t("create_space|skip_action")}
                    </AccessibleButton>
                }
                filterPlaceholder={_t("space|room_filter_placeholder")}
                onFinished={onFinished}
                roomsRenderer={defaultRoomsRenderer}
                dmsRenderer={defaultDmsRenderer}
            />
        </div>
    );
};

interface ISpaceSetupPublicShareProps extends Pick<IProps & IState, "justCreatedOpts" | "space" | "firstRoomId"> {
    onFinished(): void;
}

const SpaceSetupPublicShare: React.FC<ISpaceSetupPublicShareProps> = ({
    justCreatedOpts,
    space,
    onFinished,
    firstRoomId,
}) => {
    return (
        <div className="mx_SpaceRoomView_publicShare">
            <h1>
                {_t("create_space|share_heading", {
                    name: justCreatedOpts?.createOpts?.name || space.name,
                })}
            </h1>
            <div className="mx_SpaceRoomView_description">{_t("create_space|share_description")}</div>

            <SpacePublicShare space={space} />

            <div className="mx_SpaceRoomView_buttons">
                <AccessibleButton kind="primary" onClick={onFinished}>
                    {firstRoomId ? _t("create_space|done_action_first_room") : _t("create_space|done_action")}
                </AccessibleButton>
            </div>
        </div>
    );
};

const SpaceSetupPrivateScope: React.FC<{
    space: Room;
    justCreatedOpts?: IOpts;
    onFinished(createRooms: boolean): void;
}> = ({ space, justCreatedOpts, onFinished }) => {
    return (
        <div className="mx_SpaceRoomView_privateScope">
            <h1>{_t("create_space|private_personal_heading")}</h1>
            <div className="mx_SpaceRoomView_description">
                {_t("create_space|private_personal_description", {
                    name: justCreatedOpts?.createOpts?.name || space.name,
                })}
            </div>

            <AccessibleButton
                className="mx_SpaceRoomView_privateScope_justMeButton"
                onClick={() => {
                    onFinished(false);
                }}
            >
                {_t("create_space|personal_space")}
                <div>{_t("create_space|personal_space_description")}</div>
            </AccessibleButton>
            <AccessibleButton
                className="mx_SpaceRoomView_privateScope_meAndMyTeammatesButton"
                onClick={() => {
                    onFinished(true);
                }}
            >
                {_t("create_space|private_space")}
                <div>{_t("create_space|private_space_description")}</div>
            </AccessibleButton>
        </div>
    );
};

const validateEmailRules = withValidation({
    rules: [
        {
            key: "email",
            test: ({ value }) => !value || Email.looksValid(value),
            invalid: () => _t("auth|email_field_label_invalid"),
        },
    ],
});

const SpaceSetupPrivateInvite: React.FC<{
    space: Room;
    onFinished(): void;
}> = ({ space, onFinished }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const numFields = 3;
    const fieldRefs = [useRef<Field>(null), useRef<Field>(null), useRef<Field>(null)];
    const [emailAddresses, setEmailAddress] = useStateArray(numFields, "");
    const fields = new Array(numFields).fill(0).map((x, i) => {
        const name = "emailAddress" + i;
        return (
            <Field
                key={name}
                name={name}
                type="text"
                label={_t("common|email_address")}
                placeholder={_t("auth|email_field_label")}
                value={emailAddresses[i]}
                onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setEmailAddress(i, ev.target.value)}
                ref={fieldRefs[i]}
                onValidate={validateEmailRules}
                autoFocus={i === 0}
                disabled={busy}
            />
        );
    });

    const onNextClick = async (ev: ButtonEvent): Promise<void> => {
        ev.preventDefault();
        if (busy) return;
        setError("");
        for (const fieldRef of fieldRefs) {
            const valid = await fieldRef.current?.validate({ allowEmpty: true });

            if (valid === false) {
                // true/null are allowed
                fieldRef.current!.focus();
                fieldRef.current!.validate({ allowEmpty: true, focused: true });
                return;
            }
        }

        setBusy(true);
        const targetIds = emailAddresses.map((name) => name.trim()).filter(Boolean);
        try {
            const result = await inviteMultipleToRoom(space.client, space.roomId, targetIds);

            const failedUsers = Object.keys(result.states).filter((a) => result.states[a] === "error");
            if (failedUsers.length > 0) {
                logger.log("Failed to invite users to space: ", result);
                setError(
                    _t("create_space|failed_invite_users", {
                        csvUsers: failedUsers.join(", "),
                    }),
                );
            } else {
                onFinished();
            }
        } catch (err) {
            logger.error("Failed to invite users to space: ", err);
            setError(_t("invite|error_invite"));
        }
        setBusy(false);
    };

    let onClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        onFinished();
    };
    let buttonLabel = _t("create_space|skip_action");
    if (emailAddresses.some((name) => name.trim())) {
        onClick = onNextClick;
        buttonLabel = busy ? _t("create_space|inviting_users") : _t("action|continue");
    }

    return (
        <div className="mx_SpaceRoomView_inviteTeammates">
            <h1>{_t("create_space|invite_teammates_heading")}</h1>
            <div className="mx_SpaceRoomView_description">{_t("create_space|invite_teammates_description")}</div>

            {error && <div className="mx_SpaceRoomView_errorText">{error}</div>}
            <form onSubmit={onClick} id="mx_SpaceSetupPrivateInvite">
                {fields}
            </form>

            <div className="mx_SpaceRoomView_inviteTeammates_buttons">
                <AccessibleButton
                    className="mx_SpaceRoomView_inviteTeammates_inviteDialogButton"
                    onClick={() => showRoomInviteDialog(space.roomId)}
                >
                    {_t("create_space|invite_teammates_by_username")}
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
        </div>
    );
};

export default class SpaceRoomView extends React.PureComponent<IProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    private dispatcherRef?: string;

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        let phase = Phase.Landing;

        const creator = this.props.space.currentState.getStateEvents(EventType.RoomCreate, "")?.getSender();
        const showSetup = this.props.justCreatedOpts && context.getSafeUserId() === creator;

        if (showSetup) {
            phase =
                this.props.justCreatedOpts!.createOpts?.preset === Preset.PublicChat
                    ? Phase.PublicCreateRooms
                    : Phase.PrivateScope;
        }

        this.state = {
            phase,
            showRightPanel: RightPanelStore.instance.isOpenForRoom(this.props.space.roomId),
            myMembership: this.props.space.getMyMembership(),
        };
    }

    public componentDidMount(): void {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        RightPanelStore.instance.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        this.context.on(RoomEvent.MyMembership, this.onMyMembership);
    }

    public componentWillUnmount(): void {
        defaultDispatcher.unregister(this.dispatcherRef);
        RightPanelStore.instance.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        this.context.off(RoomEvent.MyMembership, this.onMyMembership);
    }

    private onMyMembership = (room: Room, myMembership: string): void => {
        if (room.roomId === this.props.space.roomId) {
            this.setState({ myMembership });
        }
    };

    private onRightPanelStoreUpdate = (): void => {
        this.setState({
            showRightPanel: RightPanelStore.instance.isOpenForRoom(this.props.space.roomId),
        });
    };

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.ViewRoom && payload.room_id === this.props.space.roomId) {
            this.setState({ phase: Phase.Landing });
            return;
        }
    };

    private goToFirstRoom = async (): Promise<void> => {
        if (this.state.firstRoomId) {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: this.state.firstRoomId,
                metricsTrigger: undefined, // other
            });
            return;
        }

        this.setState({ phase: Phase.Landing });
    };

    private renderBody(): JSX.Element {
        switch (this.state.phase) {
            case Phase.Landing:
                if (this.state.myMembership === KnownMembership.Join) {
                    return <SpaceLanding space={this.props.space} />;
                } else {
                    return (
                        <RoomPreviewCard
                            room={this.props.space}
                            onJoinButtonClicked={this.props.onJoinButtonClicked}
                            onRejectButtonClicked={this.props.onRejectButtonClicked}
                        />
                    );
                }
            case Phase.PublicCreateRooms:
                return (
                    <SpaceSetupFirstRooms
                        space={this.props.space}
                        title={_t("create_space|setup_rooms_community_heading", {
                            spaceName: this.props.justCreatedOpts?.createOpts?.name || this.props.space.name,
                        })}
                        description={
                            <>
                                {_t("create_space|setup_rooms_community_description")}
                                <br />
                                {_t("create_space|setup_rooms_description")}
                            </>
                        }
                        onFinished={(firstRoomId: string) => this.setState({ phase: Phase.PublicShare, firstRoomId })}
                    />
                );
            case Phase.PublicShare:
                return (
                    <SpaceSetupPublicShare
                        justCreatedOpts={this.props.justCreatedOpts}
                        space={this.props.space}
                        onFinished={this.goToFirstRoom}
                        firstRoomId={this.state.firstRoomId}
                    />
                );

            case Phase.PrivateScope:
                return (
                    <SpaceSetupPrivateScope
                        space={this.props.space}
                        justCreatedOpts={this.props.justCreatedOpts}
                        onFinished={(invite: boolean) => {
                            this.setState({ phase: invite ? Phase.PrivateCreateRooms : Phase.PrivateExistingRooms });
                        }}
                    />
                );
            case Phase.PrivateInvite:
                return (
                    <SpaceSetupPrivateInvite
                        space={this.props.space}
                        onFinished={() => this.setState({ phase: Phase.Landing })}
                    />
                );
            case Phase.PrivateCreateRooms:
                return (
                    <SpaceSetupFirstRooms
                        space={this.props.space}
                        title={_t("create_space|setup_rooms_private_heading")}
                        description={
                            <>
                                {_t("create_space|setup_rooms_private_description")}
                                <br />
                                {_t("create_space|setup_rooms_description")}
                            </>
                        }
                        onFinished={(firstRoomId: string) => this.setState({ phase: Phase.PrivateInvite, firstRoomId })}
                    />
                );
            case Phase.PrivateExistingRooms:
                return (
                    <SpaceAddExistingRooms
                        space={this.props.space}
                        onFinished={() => this.setState({ phase: Phase.Landing })}
                    />
                );
        }
    }

    public render(): React.ReactNode {
        const rightPanel =
            this.state.showRightPanel && this.state.phase === Phase.Landing ? (
                <RightPanel
                    room={this.props.space}
                    resizeNotifier={this.props.resizeNotifier}
                    permalinkCreator={this.props.permalinkCreator}
                />
            ) : undefined;

        return (
            <main className="mx_SpaceRoomView">
                <ErrorBoundary>
                    <MainSplit panel={rightPanel} resizeNotifier={this.props.resizeNotifier} analyticsRoomType="space">
                        {this.renderBody()}
                    </MainSplit>
                </ErrorBoundary>
            </main>
        );
    }
}
