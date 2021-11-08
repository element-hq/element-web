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

import React, { useContext } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { EventType } from "matrix-js-sdk/src/@types/event";

import {
    IProps as IContextMenuProps,
} from "../../structures/ContextMenu";
import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { _t } from "../../../languageHandler";
import {
    leaveSpace,
    shouldShowSpaceSettings,
    showAddExistingRooms,
    showCreateNewRoom,
    showCreateNewSubspace,
    showSpaceInvite,
    showSpaceSettings,
} from "../../../utils/space";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { ButtonEvent } from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import RoomViewStore from "../../../stores/RoomViewStore";
import { SetRightPanelPhasePayload } from "../../../dispatcher/payloads/SetRightPanelPhasePayload";
import { Action } from "../../../dispatcher/actions";
import { RightPanelPhases } from "../../../stores/RightPanelStorePhases";
import { BetaPill } from "../beta/BetaCard";
import SettingsStore from "../../../settings/SettingsStore";

interface IProps extends IContextMenuProps {
    space: Room;
}

const SpaceContextMenu = ({ space, onFinished, ...props }: IProps) => {
    const cli = useContext(MatrixClientContext);
    const userId = cli.getUserId();

    let inviteOption;
    if (space.getJoinRule() === "public" || space.canInvite(userId)) {
        const onInviteClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            showSpaceInvite(space);
            onFinished();
        };

        inviteOption = (
            <IconizedContextMenuOption
                className="mx_SpacePanel_contextMenu_inviteButton"
                iconClassName="mx_SpacePanel_iconInvite"
                label={_t("Invite people")}
                onClick={onInviteClick}
            />
        );
    }

    let settingsOption;
    let leaveSection;
    if (shouldShowSpaceSettings(space)) {
        const onSettingsClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            showSpaceSettings(space);
            onFinished();
        };

        settingsOption = (
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconSettings"
                label={_t("Settings")}
                onClick={onSettingsClick}
            />
        );
    } else {
        const onLeaveClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            leaveSpace(space);
            onFinished();
        };

        leaveSection = <IconizedContextMenuOptionList red first>
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconLeave"
                label={_t("Leave space")}
                onClick={onLeaveClick}
            />
        </IconizedContextMenuOptionList>;
    }

    let devtoolsSection;
    if (SettingsStore.getValue("developerMode")) {
        const onViewTimelineClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            defaultDispatcher.dispatch({
                action: 'view_room',
                room_id: space.roomId,
                forceTimeline: true,
            });
            onFinished();
        };

        devtoolsSection = <IconizedContextMenuOptionList first>
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconSettings"
                label={_t("See room timeline (devtools)")}
                onClick={onViewTimelineClick}
            />
        </IconizedContextMenuOptionList>;
    }

    const canAddRooms = space.currentState.maySendStateEvent(EventType.SpaceChild, userId);

    let newRoomSection;
    if (space.currentState.maySendStateEvent(EventType.SpaceChild, userId)) {
        const onNewRoomClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            showCreateNewRoom(space);
            onFinished();
        };

        const onAddExistingRoomClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            showAddExistingRooms(space);
            onFinished();
        };

        const onNewSubspaceClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            showCreateNewSubspace(space);
            onFinished();
        };

        newRoomSection = <IconizedContextMenuOptionList first>
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconPlus"
                label={_t("Create new room")}
                onClick={onNewRoomClick}
            />
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconHash"
                label={_t("Add existing room")}
                onClick={onAddExistingRoomClick}
            />
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconPlus"
                label={_t("Add space")}
                onClick={onNewSubspaceClick}
            >
                <BetaPill />
            </IconizedContextMenuOption>
        </IconizedContextMenuOptionList>;
    }

    const onMembersClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (!RoomViewStore.getRoomId()) {
            defaultDispatcher.dispatch({
                action: "view_room",
                room_id: space.roomId,
            }, true);
        }

        defaultDispatcher.dispatch<SetRightPanelPhasePayload>({
            action: Action.SetRightPanelPhase,
            phase: RightPanelPhases.SpaceMemberList,
            refireParams: { space },
        });
        onFinished();
    };

    const onExploreRoomsClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch({
            action: "view_room",
            room_id: space.roomId,
        });
        onFinished();
    };

    return <IconizedContextMenu
        {...props}
        onFinished={onFinished}
        className="mx_SpacePanel_contextMenu"
        compact
    >
        <div className="mx_SpacePanel_contextMenu_header">
            { space.name }
        </div>
        <IconizedContextMenuOptionList first>
            { inviteOption }
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconMembers"
                label={_t("Members")}
                onClick={onMembersClick}
            />
            { settingsOption }
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconExplore"
                label={canAddRooms ? _t("Manage & explore rooms") : _t("Explore rooms")}
                onClick={onExploreRoomsClick}
            />
        </IconizedContextMenuOptionList>
        { newRoomSection }
        { leaveSection }
        { devtoolsSection }
    </IconizedContextMenu>;
};

export default SpaceContextMenu;

