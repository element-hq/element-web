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
import { EventType, RoomType } from "matrix-js-sdk/src/@types/event";

import { IProps as IContextMenuProps } from "../../structures/ContextMenu";
import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { _t } from "../../../languageHandler";
import {
    shouldShowSpaceSettings,
    showCreateNewRoom,
    showCreateNewSubspace,
    showSpaceInvite,
    showSpacePreferences,
    showSpaceSettings,
} from "../../../utils/space";
import { leaveSpace } from "../../../utils/leave-behaviour";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { ButtonEvent } from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { BetaPill } from "../beta/BetaCard";
import SettingsStore from "../../../settings/SettingsStore";
import { Action } from "../../../dispatcher/actions";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import PosthogTrackers from "../../../PosthogTrackers";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";

interface IProps extends IContextMenuProps {
    space: Room;
    hideHeader?: boolean;
}

const SpaceContextMenu = ({ space, hideHeader, onFinished, ...props }: IProps) => {
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
                data-test-id='invite-option'
                className="mx_SpacePanel_contextMenu_inviteButton"
                iconClassName="mx_SpacePanel_iconInvite"
                label={_t("Invite")}
                onClick={onInviteClick}
            />
        );
    }

    let settingsOption;
    let leaveOption;
    if (shouldShowSpaceSettings(space)) {
        const onSettingsClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            showSpaceSettings(space);
            onFinished();
        };

        settingsOption = (
            <IconizedContextMenuOption
                data-test-id='settings-option'
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

        leaveOption = (
            <IconizedContextMenuOption
                data-test-id='leave-option'
                iconClassName="mx_SpacePanel_iconLeave"
                className="mx_IconizedContextMenu_option_red"
                label={_t("Leave space")}
                onClick={onLeaveClick}
            />
        );
    }

    let devtoolsOption;
    if (SettingsStore.getValue("developerMode")) {
        const onViewTimelineClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: space.roomId,
                forceTimeline: true,
                metricsTrigger: undefined, // room doesn't change
            });
            onFinished();
        };

        devtoolsOption = (
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconSettings"
                label={_t("See room timeline (devtools)")}
                onClick={onViewTimelineClick}
            />
        );
    }

    const hasPermissionToAddSpaceChild = space.currentState.maySendStateEvent(EventType.SpaceChild, userId);
    const canAddRooms = hasPermissionToAddSpaceChild && shouldShowComponent(UIComponent.CreateRooms);
    const canAddVideoRooms = canAddRooms && SettingsStore.getValue("feature_video_rooms");
    const canAddSubSpaces = hasPermissionToAddSpaceChild && shouldShowComponent(UIComponent.CreateSpaces);

    let newRoomSection: JSX.Element;
    if (canAddRooms || canAddSubSpaces) {
        const onNewRoomClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            PosthogTrackers.trackInteraction("WebSpaceContextMenuNewRoomItem", ev);
            showCreateNewRoom(space);
            onFinished();
        };

        const onNewVideoRoomClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            showCreateNewRoom(space, RoomType.ElementVideo);
            onFinished();
        };

        const onNewSubspaceClick = (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            showCreateNewSubspace(space);
            onFinished();
        };

        newRoomSection = <>
            <div data-test-id='add-to-space-header' className="mx_SpacePanel_contextMenu_separatorLabel">
                { _t("Add") }
            </div>
            { canAddRooms &&
                <IconizedContextMenuOption
                    data-test-id='new-room-option'
                    iconClassName="mx_SpacePanel_iconPlus"
                    label={_t("Room")}
                    onClick={onNewRoomClick}
                />
            }
            { canAddVideoRooms &&
                <IconizedContextMenuOption
                    data-test-id='new-video-room-option'
                    iconClassName="mx_SpacePanel_iconPlus"
                    label={_t("Video room")}
                    onClick={onNewVideoRoomClick}
                >
                    <BetaPill />
                </IconizedContextMenuOption>
            }
            { canAddSubSpaces &&
                <IconizedContextMenuOption
                    data-test-id='new-subspace-option'
                    iconClassName="mx_SpacePanel_iconPlus"
                    label={_t("Space")}
                    onClick={onNewSubspaceClick}
                >
                    <BetaPill />
                </IconizedContextMenuOption>
            }
        </>;
    }

    const onPreferencesClick = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        showSpacePreferences(space);
        onFinished();
    };

    const openSpace = (ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: space.roomId,
            metricsTrigger: undefined, // other
        });
        onFinished();
    };

    const onExploreRoomsClick = (ev: ButtonEvent) => {
        PosthogTrackers.trackInteraction("WebSpaceContextMenuExploreRoomsItem", ev);
        openSpace(ev);
    };

    const onHomeClick = (ev: ButtonEvent) => {
        PosthogTrackers.trackInteraction("WebSpaceContextMenuHomeItem", ev);
        openSpace(ev);
    };

    return <IconizedContextMenu
        {...props}
        onFinished={onFinished}
        className="mx_SpacePanel_contextMenu"
        compact
    >
        { !hideHeader && <div className="mx_SpacePanel_contextMenu_header">
            { space.name }
        </div> }
        <IconizedContextMenuOptionList first>
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconHome"
                label={_t("Space home")}
                onClick={onHomeClick}
            />
            { inviteOption }
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconExplore"
                label={canAddRooms ? _t("Manage & explore rooms") : _t("Explore rooms")}
                onClick={onExploreRoomsClick}
            />
            <IconizedContextMenuOption
                iconClassName="mx_SpacePanel_iconPreferences"
                label={_t("Preferences")}
                onClick={onPreferencesClick}
            />
            { settingsOption }
            { leaveOption }
            { devtoolsOption }
            { newRoomSection }
        </IconizedContextMenuOptionList>
    </IconizedContextMenu>;
};

export default SpaceContextMenu;

