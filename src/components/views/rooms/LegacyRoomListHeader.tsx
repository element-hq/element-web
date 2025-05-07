/*
Copyright 2024 New Vector Ltd.
Copyright 2021, 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ClientEvent, EventType, type Room, RoomEvent, RoomType } from "matrix-js-sdk/src/matrix";
import React, { type JSX, useContext, useEffect, useState } from "react";
import { Tooltip } from "@vector-im/compound-web";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { Action } from "../../../dispatcher/actions";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { useDispatcher } from "../../../hooks/useDispatcher";
import { useEventEmitterState, useTypedEventEmitter, useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import { _t } from "../../../languageHandler";
import PosthogTrackers from "../../../PosthogTrackers";
import { UIComponent } from "../../../settings/UIFeature";
import {
    getMetaSpaceName,
    MetaSpace,
    type SpaceKey,
    UPDATE_HOME_BEHAVIOUR,
    UPDATE_SELECTED_SPACE,
} from "../../../stores/spaces";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import {
    shouldShowSpaceInvite,
    showAddExistingRooms,
    showCreateNewRoom,
    showCreateNewSubspace,
    showSpaceInvite,
} from "../../../utils/space";
import {
    ChevronFace,
    ContextMenuButton,
    ContextMenuTooltipButton,
    type MenuProps,
    useContextMenu,
} from "../../structures/ContextMenu";
import { BetaPill } from "../beta/BetaCard";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import SpaceContextMenu from "../context_menus/SpaceContextMenu";
import InlineSpinner from "../elements/InlineSpinner";
import { HomeButtonContextMenu } from "../spaces/SpacePanel";

const contextMenuBelow = (elementRect: DOMRect): MenuProps => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.scrollX;
    const top = elementRect.bottom + window.scrollY + 12;
    const chevronFace = ChevronFace.None;
    return { left, top, chevronFace };
};

// Long-running actions that should trigger a spinner
enum PendingActionType {
    JoinRoom,
    BulkRedact,
}

const usePendingActions = (): Map<PendingActionType, Set<string>> => {
    const cli = useContext(MatrixClientContext);
    const [actions, setActions] = useState(new Map<PendingActionType, Set<string>>());

    const addAction = (type: PendingActionType, key: string): void => {
        const keys = new Set(actions.get(type));
        keys.add(key);
        setActions(new Map(actions).set(type, keys));
    };
    const removeAction = (type: PendingActionType, key: string): void => {
        const keys = new Set(actions.get(type));
        if (keys.delete(key)) {
            setActions(new Map(actions).set(type, keys));
        }
    };

    useDispatcher(defaultDispatcher, (payload) => {
        switch (payload.action) {
            case Action.JoinRoom:
                addAction(PendingActionType.JoinRoom, payload.roomId);
                break;
            case Action.JoinRoomReady:
            case Action.JoinRoomError:
                removeAction(PendingActionType.JoinRoom, payload.roomId);
                break;
            case Action.BulkRedactStart:
                addAction(PendingActionType.BulkRedact, payload.roomId);
                break;
            case Action.BulkRedactEnd:
                removeAction(PendingActionType.BulkRedact, payload.roomId);
                break;
        }
    });
    useTypedEventEmitter(cli, ClientEvent.Room, (room: Room) => removeAction(PendingActionType.JoinRoom, room.roomId));

    return actions;
};

interface IProps {
    onVisibilityChange?(): void;
}

const LegacyRoomListHeader: React.FC<IProps> = ({ onVisibilityChange }) => {
    const cli = useContext(MatrixClientContext);
    const [mainMenuDisplayed, mainMenuHandle, openMainMenu, closeMainMenu] = useContextMenu<HTMLDivElement>();
    const [plusMenuDisplayed, plusMenuHandle, openPlusMenu, closePlusMenu] = useContextMenu<HTMLDivElement>();
    const [spaceKey, activeSpace] = useEventEmitterState<[SpaceKey, Room | null]>(
        SpaceStore.instance,
        UPDATE_SELECTED_SPACE,
        () => [SpaceStore.instance.activeSpace, SpaceStore.instance.activeSpaceRoom],
    );
    const allRoomsInHome = useEventEmitterState(SpaceStore.instance, UPDATE_HOME_BEHAVIOUR, () => {
        return SpaceStore.instance.allRoomsInHome;
    });
    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms");
    const pendingActions = usePendingActions();

    const canShowMainMenu = activeSpace || spaceKey === MetaSpace.Home;

    useEffect(() => {
        if (mainMenuDisplayed && !canShowMainMenu) {
            // Space changed under us and we no longer has a main menu to draw
            closeMainMenu();
        }
    }, [closeMainMenu, canShowMainMenu, mainMenuDisplayed]);

    const spaceName = useTypedEventEmitterState(activeSpace ?? undefined, RoomEvent.Name, () => activeSpace?.name);

    useEffect(() => {
        onVisibilityChange?.();
    }, [onVisibilityChange]);

    const canExploreRooms = shouldShowComponent(UIComponent.ExploreRooms);
    const canCreateRooms = shouldShowComponent(UIComponent.CreateRooms);
    const canCreateSpaces = shouldShowComponent(UIComponent.CreateSpaces);

    const hasPermissionToAddSpaceChild = activeSpace?.currentState?.maySendStateEvent(
        EventType.SpaceChild,
        cli.getUserId()!,
    );
    const canAddSubRooms = hasPermissionToAddSpaceChild && canCreateRooms;
    const canAddSubSpaces = hasPermissionToAddSpaceChild && canCreateSpaces;

    // If the user can't do anything on the plus menu, don't show it. This aims to target the
    // plus menu shown on the Home tab primarily: the user has options to use the menu for
    // communities and spaces, but is at risk of no options on the Home tab.
    const canShowPlusMenu = canCreateRooms || canExploreRooms || canCreateSpaces || activeSpace;

    let contextMenu: JSX.Element | undefined;
    if (mainMenuDisplayed && mainMenuHandle.current) {
        let ContextMenuComponent;
        if (activeSpace) {
            ContextMenuComponent = SpaceContextMenu;
        } else {
            ContextMenuComponent = HomeButtonContextMenu;
        }

        contextMenu = (
            <ContextMenuComponent
                {...contextMenuBelow(mainMenuHandle.current.getBoundingClientRect())}
                space={activeSpace!}
                onFinished={closeMainMenu}
                hideHeader={true}
            />
        );
    } else if (plusMenuDisplayed && activeSpace) {
        let inviteOption: JSX.Element | undefined;
        if (shouldShowSpaceInvite(activeSpace)) {
            inviteOption = (
                <IconizedContextMenuOption
                    label={_t("action|invite")}
                    iconClassName="mx_LegacyRoomListHeader_iconInvite"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showSpaceInvite(activeSpace);
                        closePlusMenu();
                    }}
                />
            );
        }

        let newRoomOptions: JSX.Element | undefined;
        if (activeSpace?.currentState.maySendStateEvent(EventType.RoomAvatar, cli.getUserId()!)) {
            newRoomOptions = (
                <>
                    <IconizedContextMenuOption
                        iconClassName="mx_LegacyRoomListHeader_iconNewRoom"
                        label={_t("action|new_room")}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            showCreateNewRoom(activeSpace);
                            PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateRoomItem", e);
                            closePlusMenu();
                        }}
                    />
                    {videoRoomsEnabled && (
                        <IconizedContextMenuOption
                            iconClassName="mx_LegacyRoomListHeader_iconNewVideoRoom"
                            label={_t("action|new_video_room")}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showCreateNewRoom(
                                    activeSpace,
                                    elementCallVideoRoomsEnabled ? RoomType.UnstableCall : RoomType.ElementVideo,
                                );
                                closePlusMenu();
                            }}
                        >
                            <BetaPill />
                        </IconizedContextMenuOption>
                    )}
                </>
            );
        }

        contextMenu = (
            <IconizedContextMenu
                {...contextMenuBelow(plusMenuHandle.current!.getBoundingClientRect())}
                onFinished={closePlusMenu}
                compact
            >
                <IconizedContextMenuOptionList first>
                    {inviteOption}
                    {newRoomOptions}
                    <IconizedContextMenuOption
                        label={_t("action|explore_rooms")}
                        iconClassName="mx_LegacyRoomListHeader_iconExplore"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            defaultDispatcher.dispatch<ViewRoomPayload>({
                                action: Action.ViewRoom,
                                room_id: activeSpace.roomId,
                                metricsTrigger: undefined, // other
                            });
                            closePlusMenu();
                            PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuExploreRoomsItem", e);
                        }}
                    />
                    <IconizedContextMenuOption
                        label={_t("action|add_existing_room")}
                        iconClassName="mx_LegacyRoomListHeader_iconPlus"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            showAddExistingRooms(activeSpace);
                            closePlusMenu();
                        }}
                        disabled={!canAddSubRooms}
                        title={!canAddSubRooms ? _t("spaces|error_no_permission_add_room") : undefined}
                    />
                    {canCreateSpaces && (
                        <IconizedContextMenuOption
                            label={_t("room_list|add_space_label")}
                            iconClassName="mx_LegacyRoomListHeader_iconPlus"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showCreateNewSubspace(activeSpace);
                                closePlusMenu();
                            }}
                            disabled={!canAddSubSpaces}
                            title={!canAddSubSpaces ? _t("spaces|error_no_permission_add_space") : undefined}
                        >
                            <BetaPill />
                        </IconizedContextMenuOption>
                    )}
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>
        );
    } else if (plusMenuDisplayed) {
        let newRoomOpts: JSX.Element | undefined;
        let joinRoomOpt: JSX.Element | undefined;

        if (canCreateRooms) {
            newRoomOpts = (
                <>
                    <IconizedContextMenuOption
                        label={_t("action|start_new_chat")}
                        iconClassName="mx_LegacyRoomListHeader_iconStartChat"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            defaultDispatcher.dispatch({ action: Action.CreateChat });
                            PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateChatItem", e);
                            closePlusMenu();
                        }}
                    />
                    <IconizedContextMenuOption
                        label={_t("action|new_room")}
                        iconClassName="mx_LegacyRoomListHeader_iconNewRoom"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            defaultDispatcher.dispatch({ action: Action.CreateRoom });
                            PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateRoomItem", e);
                            closePlusMenu();
                        }}
                    />
                    {videoRoomsEnabled && (
                        <IconizedContextMenuOption
                            label={_t("action|new_video_room")}
                            iconClassName="mx_LegacyRoomListHeader_iconNewVideoRoom"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                defaultDispatcher.dispatch({
                                    action: Action.CreateRoom,
                                    type: elementCallVideoRoomsEnabled ? RoomType.UnstableCall : RoomType.ElementVideo,
                                });
                                closePlusMenu();
                            }}
                        >
                            <BetaPill />
                        </IconizedContextMenuOption>
                    )}
                </>
            );
        }
        if (canExploreRooms) {
            joinRoomOpt = (
                <IconizedContextMenuOption
                    label={_t("room_list|join_public_room_label")}
                    iconClassName="mx_LegacyRoomListHeader_iconExplore"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        defaultDispatcher.dispatch({ action: Action.ViewRoomDirectory });
                        PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuExploreRoomsItem", e);
                        closePlusMenu();
                    }}
                />
            );
        }

        contextMenu = (
            <IconizedContextMenu
                {...contextMenuBelow(plusMenuHandle.current!.getBoundingClientRect())}
                onFinished={closePlusMenu}
                compact
            >
                <IconizedContextMenuOptionList first>
                    {newRoomOpts}
                    {joinRoomOpt}
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>
        );
    }

    let title: string;
    if (activeSpace && spaceName) {
        title = spaceName;
    } else {
        title = getMetaSpaceName(spaceKey as MetaSpace, allRoomsInHome);
    }

    const pendingActionSummary = [...pendingActions.entries()]
        .filter(([type, keys]) => keys.size > 0)
        .map(([type, keys]) => {
            switch (type) {
                case PendingActionType.JoinRoom:
                    return _t("room_list|joining_rooms_status", { count: keys.size });
                case PendingActionType.BulkRedact:
                    return _t("room_list|redacting_messages_status", { count: keys.size });
            }
        })
        .join("\n");

    let contextMenuButton: JSX.Element = <div className="mx_LegacyRoomListHeader_contextLessTitle">{title}</div>;
    if (canShowMainMenu) {
        const commonProps = {
            ref: mainMenuHandle,
            onClick: openMainMenu,
            isExpanded: mainMenuDisplayed,
            className: "mx_LegacyRoomListHeader_contextMenuButton",
            children: title,
        };

        if (!!activeSpace) {
            contextMenuButton = (
                <ContextMenuButton
                    {...commonProps}
                    label={_t("room_list|space_menu_label", { spaceName: spaceName ?? activeSpace.name })}
                />
            );
        } else {
            contextMenuButton = <ContextMenuTooltipButton {...commonProps} title={_t("room_list|home_menu_label")} />;
        }
    }

    return (
        <aside className="mx_LegacyRoomListHeader" aria-label={_t("room|context_menu|title")}>
            {contextMenuButton}
            {pendingActionSummary ? (
                <Tooltip label={pendingActionSummary} isTriggerInteractive={false}>
                    <InlineSpinner />
                </Tooltip>
            ) : null}
            {canShowPlusMenu && (
                <ContextMenuTooltipButton
                    ref={plusMenuHandle}
                    onClick={openPlusMenu}
                    isExpanded={plusMenuDisplayed}
                    className="mx_LegacyRoomListHeader_plusButton"
                    title={_t("action|add")}
                />
            )}

            {contextMenu}
        </aside>
    );
};

export default LegacyRoomListHeader;
