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

import React, { ComponentProps, useContext, useEffect, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { EventType } from "matrix-js-sdk/src/@types/event";

import { _t } from "../../../languageHandler";
import { useEventEmitter, useEventEmitterState } from "../../../hooks/useEventEmitter";
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
import { shouldShowSpaceInvite, showCreateNewRoom, showSpaceInvite } from "../../../utils/space";
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
            dis.dispatch({
                action: 'view_room',
                room_id: chat.roomId,
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

const useJoiningRooms = (): Set<string> => {
    const cli = useContext(MatrixClientContext);
    const [joiningRooms, setJoiningRooms] = useState(new Set<string>());
    useDispatcher(defaultDispatcher, payload => {
        switch (payload.action) {
            case Action.JoinRoom:
                setJoiningRooms(new Set(joiningRooms.add(payload.roomId)));
                break;
            case Action.JoinRoomReady:
            case Action.JoinRoomError:
                if (joiningRooms.delete(payload.roomId)) {
                    setJoiningRooms(new Set(joiningRooms));
                }
                break;
        }
    });
    useEventEmitter(cli, "Room", (room: Room) => {
        if (joiningRooms.delete(room.roomId)) {
            setJoiningRooms(new Set(joiningRooms));
        }
    });

    return joiningRooms;
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
    const joiningRooms = useJoiningRooms();

    const count = useEventEmitterState(RoomListStore.instance, LISTS_UPDATE_EVENT, () => {
        if (RoomListStore.instance.getFirstNameFilterCondition()) {
            return Object.values(RoomListStore.instance.orderedLists).flat(1).length;
        } else {
            return null;
        }
    });

    const spaceName = useEventEmitterState(activeSpace, "Room.name", () => activeSpace?.name);

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
                { createNewRoomOption }
                <IconizedContextMenuOption
                    label={_t("Explore rooms")}
                    iconClassName="mx_RoomListHeader_iconExplore"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        defaultDispatcher.dispatch({ action: Action.ViewRoomDirectory });
                        closePlusMenu();
                    }}
                />
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>;
    } else if (plusMenuDisplayed) {
        contextMenu = <IconizedContextMenu
            {...contextMenuBelow(plusMenuHandle.current.getBoundingClientRect())}
            onFinished={closePlusMenu}
            compact
        >
            <IconizedContextMenuOptionList first>
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
                <IconizedContextMenuOption
                    label={_t("Create new room")}
                    iconClassName="mx_RoomListHeader_iconCreateRoom"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        defaultDispatcher.dispatch({ action: "view_create_room" });
                        closePlusMenu();
                    }}
                />
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

    let pendingRoomJoinSpinner: JSX.Element;
    if (joiningRooms.size) {
        pendingRoomJoinSpinner = <TooltipTarget
            label={_t("Currently joining %(count)s rooms", { count: joiningRooms.size })}
        >
            <InlineSpinner />
        </TooltipTarget>;
    }

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
        { pendingRoomJoinSpinner }
        <ContextMenuTooltipButton
            inputRef={plusMenuHandle}
            onClick={openPlusMenu}
            isExpanded={plusMenuDisplayed}
            className="mx_RoomListHeader_plusButton"
            title={_t("Add")}
        />

        { contextMenu }
    </div>;
};

export default RoomListHeader;
