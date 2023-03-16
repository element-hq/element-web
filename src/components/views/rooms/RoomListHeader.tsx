/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

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

import { EventType, RoomType } from "matrix-js-sdk/src/@types/event";
import { ClientEvent } from "matrix-js-sdk/src/client";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import React, { useContext, useEffect, useState } from "react";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { Action } from "../../../dispatcher/actions";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { useDispatcher } from "../../../hooks/useDispatcher";
import { useEventEmitterState, useTypedEventEmitter, useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import { _t } from "../../../languageHandler";
import PosthogTrackers from "../../../PosthogTrackers";
import { UIComponent } from "../../../settings/UIFeature";
import {
    getMetaSpaceName,
    MetaSpace,
    SpaceKey,
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
import { ChevronFace, ContextMenuTooltipButton, useContextMenu, MenuProps } from "../../structures/ContextMenu";
import { BetaPill } from "../beta/BetaCard";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import SpaceContextMenu from "../context_menus/SpaceContextMenu";
import InlineSpinner from "../elements/InlineSpinner";
import TooltipTarget from "../elements/TooltipTarget";
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

const RoomListHeader: React.FC<IProps> = ({ onVisibilityChange }) => {
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
                space={activeSpace}
                onFinished={closeMainMenu}
                hideHeader={true}
            />
        );
    } else if (plusMenuDisplayed && activeSpace) {
        let inviteOption: JSX.Element | undefined;
        if (shouldShowSpaceInvite(activeSpace)) {
            inviteOption = (
                <IconizedContextMenuOption
                    label={_t("Invite")}
                    iconClassName="mx_RoomListHeader_iconInvite"
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
                        iconClassName="mx_RoomListHeader_iconNewRoom"
                        label={_t("New room")}
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
                            iconClassName="mx_RoomListHeader_iconNewVideoRoom"
                            label={_t("New video room")}
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
                        label={_t("Explore rooms")}
                        iconClassName="mx_RoomListHeader_iconExplore"
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
                        label={_t("Add existing room")}
                        iconClassName="mx_RoomListHeader_iconPlus"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            showAddExistingRooms(activeSpace);
                            closePlusMenu();
                        }}
                        disabled={!canAddSubRooms}
                        tooltip={
                            !canAddSubRooms ? _t("You do not have permissions to add rooms to this space") : undefined
                        }
                    />
                    {canCreateSpaces && (
                        <IconizedContextMenuOption
                            label={_t("Add space")}
                            iconClassName="mx_RoomListHeader_iconPlus"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                showCreateNewSubspace(activeSpace);
                                closePlusMenu();
                            }}
                            disabled={!canAddSubSpaces}
                            tooltip={
                                !canAddSubSpaces
                                    ? _t("You do not have permissions to add spaces to this space")
                                    : undefined
                            }
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
                        label={_t("Start new chat")}
                        iconClassName="mx_RoomListHeader_iconStartChat"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            defaultDispatcher.dispatch({ action: "view_create_chat" });
                            PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateChatItem", e);
                            closePlusMenu();
                        }}
                    />
                    <IconizedContextMenuOption
                        label={_t("New room")}
                        iconClassName="mx_RoomListHeader_iconNewRoom"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            defaultDispatcher.dispatch({ action: "view_create_room" });
                            PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateRoomItem", e);
                            closePlusMenu();
                        }}
                    />
                    {videoRoomsEnabled && (
                        <IconizedContextMenuOption
                            label={_t("New video room")}
                            iconClassName="mx_RoomListHeader_iconNewVideoRoom"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                defaultDispatcher.dispatch({
                                    action: "view_create_room",
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
                    label={_t("Join public room")}
                    iconClassName="mx_RoomListHeader_iconExplore"
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
                    return _t("Currently joining %(count)s rooms", { count: keys.size });
                case PendingActionType.BulkRedact:
                    return _t("Currently removing messages in %(count)s rooms", { count: keys.size });
            }
        })
        .join("\n");

    let contextMenuButton: JSX.Element = <div className="mx_RoomListHeader_contextLessTitle">{title}</div>;
    if (canShowMainMenu) {
        contextMenuButton = (
            <ContextMenuTooltipButton
                inputRef={mainMenuHandle}
                onClick={openMainMenu}
                isExpanded={mainMenuDisplayed}
                className="mx_RoomListHeader_contextMenuButton"
                title={
                    activeSpace
                        ? _t("%(spaceName)s menu", { spaceName: spaceName ?? activeSpace.name })
                        : _t("Home options")
                }
            >
                {title}
            </ContextMenuTooltipButton>
        );
    }

    return (
        <div className="mx_RoomListHeader">
            {contextMenuButton}
            {pendingActionSummary ? (
                <TooltipTarget label={pendingActionSummary}>
                    <InlineSpinner />
                </TooltipTarget>
            ) : null}
            {canShowPlusMenu && (
                <ContextMenuTooltipButton
                    inputRef={plusMenuHandle}
                    onClick={openPlusMenu}
                    isExpanded={plusMenuDisplayed}
                    className="mx_RoomListHeader_plusButton"
                    title={_t("Add")}
                />
            )}

            {contextMenu}
        </div>
    );
};

export default RoomListHeader;
