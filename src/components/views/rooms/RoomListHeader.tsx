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

import React, { ComponentProps, useContext, useEffect, useState } from "react";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { ClientEvent } from "matrix-js-sdk/src/client";

import { _t } from "../../../languageHandler";
import { useEventEmitterState, useTypedEventEmitter, useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import { ChevronFace, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import SpaceContextMenu from "../context_menus/SpaceContextMenu";
import { HomeButtonContextMenu } from "../spaces/SpacePanel";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import dis from "../../../dispatcher/dispatcher";
import {
    shouldShowSpaceInvite,
    showAddExistingRooms,
    showCreateNewRoom,
    showCreateNewSubspace,
    showSpaceInvite,
} from "../../../utils/space";
import { CommunityPrototypeStore } from "../../../stores/CommunityPrototypeStore";
import { ButtonEvent } from "../elements/AccessibleButton";
import Modal from "../../../Modal";
import EditCommunityPrototypeDialog from "../dialogs/EditCommunityPrototypeDialog";
import { Action } from "../../../dispatcher/actions";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import ErrorDialog from "../dialogs/ErrorDialog";
import { showCommunityInviteDialog } from "../../../RoomInvite";
import { useDispatcher } from "../../../hooks/useDispatcher";
import InlineSpinner from "../elements/InlineSpinner";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import {
    getMetaSpaceName,
    MetaSpace,
    SpaceKey,
    UPDATE_HOME_BEHAVIOUR,
    UPDATE_SELECTED_SPACE,
} from "../../../stores/spaces";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import TooltipTarget from "../elements/TooltipTarget";
import { BetaPill } from "../beta/BetaCard";
import PosthogTrackers from "../../../PosthogTrackers";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { useWebSearchMetrics } from "../dialogs/SpotlightDialog";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";

const contextMenuBelow = (elementRect: DOMRect) => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.pageXOffset;
    const top = elementRect.bottom + window.pageYOffset + 12;
    const chevronFace = ChevronFace.None;
    return { left, top, chevronFace };
};

const PrototypeCommunityContextMenu = (props: ComponentProps<typeof SpaceContextMenu>) => {
    const communityId = CommunityPrototypeStore.instance.getSelectedCommunityId();

    let settingsOption;
    if (CommunityPrototypeStore.instance.isAdminOf(communityId)) {
        const onCommunitySettingsClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            Modal.createTrackedDialog('Edit Community', '', EditCommunityPrototypeDialog, {
                communityId: CommunityPrototypeStore.instance.getSelectedCommunityId(),
            });
            props.onFinished();
        };

        settingsOption = (
            <IconizedContextMenuOption
                iconClassName="mx_UserMenu_iconSettings"
                label={_t("Settings")}
                aria-label={_t("Community settings")}
                onClick={onCommunitySettingsClick}
            />
        );
    }

    const onCommunityMembersClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        // We'd ideally just pop open a right panel with the member list, but the current
        // way the right panel is structured makes this exceedingly difficult. Instead, we'll
        // switch to the general room and open the member list there as it should be in sync
        // anyways.
        const chat = CommunityPrototypeStore.instance.getSelectedCommunityGeneralChat();
        if (chat) {
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: chat.roomId,
                metricsTrigger: undefined, // Deprecated groups
            }, true);
            RightPanelStore.instance.setCard({ phase: RightPanelPhases.RoomMemberList }, undefined, chat.roomId);
        } else {
            // "This should never happen" clauses go here for the prototype.
            Modal.createTrackedDialog('Failed to find general chat', '', ErrorDialog, {
                title: _t('Failed to find the general chat for this community'),
                description: _t("Failed to find the general chat for this community"),
            });
        }
        props.onFinished();
    };

    return <IconizedContextMenu {...props} compact>
        <IconizedContextMenuOptionList first>
            { settingsOption }
            <IconizedContextMenuOption
                iconClassName="mx_UserMenu_iconMembers"
                label={_t("Members")}
                onClick={onCommunityMembersClick}
            />
        </IconizedContextMenuOptionList>
    </IconizedContextMenu>;
};

// Long-running actions that should trigger a spinner
enum PendingActionType {
    JoinRoom,
    BulkRedact,
}

const usePendingActions = (): Map<PendingActionType, Set<string>> => {
    const cli = useContext(MatrixClientContext);
    const [actions, setActions] = useState(new Map<PendingActionType, Set<string>>());

    const addAction = (type: PendingActionType, key: string) => {
        const keys = new Set(actions.get(type));
        keys.add(key);
        setActions(new Map(actions).set(type, keys));
    };
    const removeAction = (type: PendingActionType, key: string) => {
        const keys = new Set(actions.get(type));
        if (keys.delete(key)) {
            setActions(new Map(actions).set(type, keys));
        }
    };

    useDispatcher(defaultDispatcher, payload => {
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
    useTypedEventEmitter(cli, ClientEvent.Room, (room: Room) =>
        removeAction(PendingActionType.JoinRoom, room.roomId),
    );

    return actions;
};

interface IProps {
    spacePanelDisabled: boolean;
    onVisibilityChange?(): void;
}

const RoomListHeader = ({ spacePanelDisabled, onVisibilityChange }: IProps) => {
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
    const pendingActions = usePendingActions();

    const filterCondition = RoomListStore.instance.getFirstNameFilterCondition();
    const count = useEventEmitterState(RoomListStore.instance, LISTS_UPDATE_EVENT, () => {
        if (filterCondition) {
            return Object.values(RoomListStore.instance.orderedLists).flat(1).length;
        } else {
            return null;
        }
    });

    // we pass null for the queryLength to inhibit the metrics hook for when there is no filterCondition
    useWebSearchMetrics(count, filterCondition ? filterCondition.search.length : null, false);

    const spaceName = useTypedEventEmitterState(activeSpace, RoomEvent.Name, () => activeSpace?.name);

    useEffect(() => {
        if (onVisibilityChange) {
            onVisibilityChange();
        }
    }, [count, onVisibilityChange]);

    if (typeof count === "number") {
        return <div className="mx_LeftPanel_roomListFilterCount">
            { _t("%(count)s results", { count }) }
        </div>;
    } else if (spacePanelDisabled) {
        return null;
    }

    const communityId = CommunityPrototypeStore.instance.getSelectedCommunityId();
    const canAddRooms = activeSpace?.currentState?.maySendStateEvent(EventType.SpaceChild, cli.getUserId());

    const canCreateRooms = shouldShowComponent(UIComponent.CreateRooms);
    const canExploreRooms = shouldShowComponent(UIComponent.ExploreRooms);

    // If the user can't do anything on the plus menu, don't show it. This aims to target the
    // plus menu shown on the Home tab primarily: the user has options to use the menu for
    // communities and spaces, but is at risk of no options on the Home tab.
    const canShowPlusMenu = canCreateRooms || canExploreRooms || activeSpace || communityId;

    let contextMenu: JSX.Element;
    if (mainMenuDisplayed) {
        let ContextMenuComponent;
        if (activeSpace) {
            ContextMenuComponent = SpaceContextMenu;
        } else if (communityId) {
            ContextMenuComponent = PrototypeCommunityContextMenu;
        } else {
            ContextMenuComponent = HomeButtonContextMenu;
        }

        contextMenu = <ContextMenuComponent
            {...contextMenuBelow(mainMenuHandle.current.getBoundingClientRect())}
            space={activeSpace}
            onFinished={closeMainMenu}
            hideHeader={true}
        />;
    } else if (plusMenuDisplayed && activeSpace) {
        let inviteOption: JSX.Element;
        if (shouldShowSpaceInvite(activeSpace)) {
            inviteOption = <IconizedContextMenuOption
                label={_t("Invite")}
                iconClassName="mx_RoomListHeader_iconInvite"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showSpaceInvite(activeSpace);
                    closePlusMenu();
                }}
            />;
        } else if (CommunityPrototypeStore.instance.canInviteTo(communityId)) {
            inviteOption = <IconizedContextMenuOption
                iconClassName="mx_RoomListHeader_iconInvite"
                label={_t("Invite")}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showCommunityInviteDialog(CommunityPrototypeStore.instance.getSelectedCommunityId());
                    closePlusMenu();
                }}
            />;
        }

        let createNewRoomOption: JSX.Element;
        if (activeSpace?.currentState.maySendStateEvent(EventType.RoomAvatar, cli.getUserId())) {
            createNewRoomOption = <IconizedContextMenuOption
                iconClassName="mx_RoomListHeader_iconCreateRoom"
                label={_t("Create new room")}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showCreateNewRoom(activeSpace);
                    PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateRoomItem", e);
                    closePlusMenu();
                }}
            />;
        }

        contextMenu = <IconizedContextMenu
            {...contextMenuBelow(plusMenuHandle.current.getBoundingClientRect())}
            onFinished={closePlusMenu}
            compact
        >
            <IconizedContextMenuOptionList first>
                { inviteOption }
                { createNewRoomOption }
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
                    disabled={!canAddRooms}
                    tooltip={!canAddRooms && _t("You do not have permissions to add rooms to this space")}
                />
                <IconizedContextMenuOption
                    label={_t("Add space")}
                    iconClassName="mx_RoomListHeader_iconPlus"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showCreateNewSubspace(activeSpace);
                        closePlusMenu();
                    }}
                    disabled={!canAddRooms}
                    tooltip={!canAddRooms && _t("You do not have permissions to add spaces to this space")}
                >
                    <BetaPill />
                </IconizedContextMenuOption>
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>;
    } else if (plusMenuDisplayed) {
        let startChatOpt: JSX.Element;
        let createRoomOpt: JSX.Element;
        let joinRoomOpt: JSX.Element;

        if (canCreateRooms) {
            startChatOpt = (
                <IconizedContextMenuOption
                    label={_t("Start new chat")}
                    iconClassName="mx_RoomListHeader_iconStartChat"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        defaultDispatcher.dispatch({ action: "view_create_chat" });
                        closePlusMenu();
                    }}
                />
            );
            createRoomOpt = (
                <IconizedContextMenuOption
                    label={_t("Create new room")}
                    iconClassName="mx_RoomListHeader_iconCreateRoom"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        defaultDispatcher.dispatch({ action: "view_create_room" });
                        PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateRoomItem", e);
                        closePlusMenu();
                    }}
                />
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
                        closePlusMenu();
                    }}
                />
            );
        }

        contextMenu = <IconizedContextMenu
            {...contextMenuBelow(plusMenuHandle.current.getBoundingClientRect())}
            onFinished={closePlusMenu}
            compact
        >
            <IconizedContextMenuOptionList first>
                { startChatOpt }
                { createRoomOpt }
                { joinRoomOpt }
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>;
    }

    let title: string;
    if (activeSpace) {
        title = spaceName;
    } else if (communityId) {
        title = CommunityPrototypeStore.instance.getSelectedCommunityName();
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

    let contextMenuButton: JSX.Element = <div className="mx_RoomListHeader_contextLessTitle">{ title }</div>;
    if (activeSpace || spaceKey === MetaSpace.Home) {
        contextMenuButton = <ContextMenuTooltipButton
            inputRef={mainMenuHandle}
            onClick={openMainMenu}
            isExpanded={mainMenuDisplayed}
            className="mx_RoomListHeader_contextMenuButton"
            title={activeSpace
                ? _t("%(spaceName)s menu", { spaceName })
                : _t("Home options")}
        >
            { title }
        </ContextMenuTooltipButton>;
    }

    return <div className="mx_RoomListHeader">
        { contextMenuButton }
        { pendingActionSummary ?
            <TooltipTarget label={pendingActionSummary}><InlineSpinner /></TooltipTarget> :
            null }
        { canShowPlusMenu && <ContextMenuTooltipButton
            inputRef={plusMenuHandle}
            onClick={openPlusMenu}
            isExpanded={plusMenuDisplayed}
            className="mx_RoomListHeader_plusButton"
            title={_t("Add")}
        /> }

        { contextMenu }
    </div>;
};

export default RoomListHeader;
