/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import { type Room, EventType, RoomType } from "matrix-js-sdk/src/matrix";

import { type IProps as IContextMenuProps } from "../../structures/ContextMenu";
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
import { type ButtonEvent } from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { BetaPill } from "../beta/BetaCard";
import SettingsStore from "../../../settings/SettingsStore";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import { Action } from "../../../dispatcher/actions";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import PosthogTrackers from "../../../PosthogTrackers";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";

interface IProps extends IContextMenuProps {
    space?: Room;
    hideHeader?: boolean;
}

const SpaceContextMenu: React.FC<IProps> = ({ space, hideHeader, onFinished, ...props }) => {
    const cli = useContext(MatrixClientContext);
    const userId = cli.getSafeUserId();
    const videoRoomsEnabled = useFeatureEnabled("feature_video_rooms");
    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms");

    if (!space) return null;

    let inviteOption: JSX.Element | null = null;
    if (space.getJoinRule() === "public" || space.canInvite(userId)) {
        const onInviteClick = (ev: ButtonEvent): void => {
            ev.preventDefault();
            ev.stopPropagation();

            showSpaceInvite(space);
            onFinished();
        };

        inviteOption = (
            <IconizedContextMenuOption
                data-testid="invite-option"
                className="mx_SpacePanel_contextMenu_inviteButton"
                iconClassName="mx_SpacePanel_iconInvite"
                label={_t("action|invite")}
                onClick={onInviteClick}
            />
        );
    }

    let settingsOption: JSX.Element | null = null;
    let leaveOption: JSX.Element | null = null;
    if (shouldShowSpaceSettings(space)) {
        const onSettingsClick = (ev: ButtonEvent): void => {
            ev.preventDefault();
            ev.stopPropagation();

            showSpaceSettings(space);
            onFinished();
        };

        settingsOption = (
            <IconizedContextMenuOption
                data-testid="settings-option"
                iconClassName="mx_SpacePanel_iconSettings"
                label={_t("common|settings")}
                onClick={onSettingsClick}
            />
        );
    } else {
        const onLeaveClick = (ev: ButtonEvent): void => {
            ev.preventDefault();
            ev.stopPropagation();

            leaveSpace(space);
            onFinished();
        };

        leaveOption = (
            <IconizedContextMenuOption
                data-testid="leave-option"
                iconClassName="mx_SpacePanel_iconLeave"
                className="mx_IconizedContextMenu_option_red"
                label={_t("space|leave_dialog_action")}
                onClick={onLeaveClick}
            />
        );
    }

    let devtoolsOption: JSX.Element | null = null;
    if (SettingsStore.getValue("developerMode")) {
        const onViewTimelineClick = (ev: ButtonEvent): void => {
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
                label={_t("space|context_menu|devtools_open_timeline")}
                onClick={onViewTimelineClick}
            />
        );
    }

    const hasPermissionToAddSpaceChild = space.currentState.maySendStateEvent(EventType.SpaceChild, userId);
    const canAddRooms = hasPermissionToAddSpaceChild && shouldShowComponent(UIComponent.CreateRooms);
    const canAddVideoRooms = canAddRooms && videoRoomsEnabled;
    const canAddSubSpaces = hasPermissionToAddSpaceChild && shouldShowComponent(UIComponent.CreateSpaces);

    let newRoomSection: JSX.Element | null = null;
    if (canAddRooms || canAddSubSpaces) {
        const onNewRoomClick = (ev: ButtonEvent): void => {
            ev.preventDefault();
            ev.stopPropagation();

            PosthogTrackers.trackInteraction("WebSpaceContextMenuNewRoomItem", ev);
            showCreateNewRoom(space);
            onFinished();
        };

        const onNewVideoRoomClick = (ev: ButtonEvent): void => {
            ev.preventDefault();
            ev.stopPropagation();

            showCreateNewRoom(space, elementCallVideoRoomsEnabled ? RoomType.UnstableCall : RoomType.ElementVideo);
            onFinished();
        };

        const onNewSubspaceClick = (ev: ButtonEvent): void => {
            ev.preventDefault();
            ev.stopPropagation();

            showCreateNewSubspace(space);
            onFinished();
        };

        newRoomSection = (
            <>
                <div data-testid="add-to-space-header" className="mx_SpacePanel_contextMenu_separatorLabel">
                    {_t("action|add")}
                </div>
                {canAddRooms && (
                    <IconizedContextMenuOption
                        data-testid="new-room-option"
                        iconClassName="mx_SpacePanel_iconPlus"
                        label={_t("common|room")}
                        onClick={onNewRoomClick}
                    />
                )}
                {canAddVideoRooms && (
                    <IconizedContextMenuOption
                        data-testid="new-video-room-option"
                        iconClassName="mx_SpacePanel_iconPlus"
                        label={_t("common|video_room")}
                        onClick={onNewVideoRoomClick}
                    >
                        <BetaPill />
                    </IconizedContextMenuOption>
                )}
                {canAddSubSpaces && (
                    <IconizedContextMenuOption
                        data-testid="new-subspace-option"
                        iconClassName="mx_SpacePanel_iconPlus"
                        label={_t("common|space")}
                        onClick={onNewSubspaceClick}
                    >
                        <BetaPill />
                    </IconizedContextMenuOption>
                )}
            </>
        );
    }

    const onPreferencesClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();

        showSpacePreferences(space);
        onFinished();
    };

    const openSpace = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();

        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: space.roomId,
            metricsTrigger: undefined, // other
        });
        onFinished();
    };

    const onExploreRoomsClick = (ev: ButtonEvent): void => {
        PosthogTrackers.trackInteraction("WebSpaceContextMenuExploreRoomsItem", ev);
        openSpace(ev);
    };

    const onHomeClick = (ev: ButtonEvent): void => {
        PosthogTrackers.trackInteraction("WebSpaceContextMenuHomeItem", ev);
        openSpace(ev);
    };

    return (
        <IconizedContextMenu {...props} onFinished={onFinished} className="mx_SpacePanel_contextMenu" compact>
            {!hideHeader && <div className="mx_SpacePanel_contextMenu_header">{space.name}</div>}
            <IconizedContextMenuOptionList first>
                <IconizedContextMenuOption
                    iconClassName="mx_SpacePanel_iconHome"
                    label={_t("space|context_menu|home")}
                    onClick={onHomeClick}
                />
                {inviteOption}
                <IconizedContextMenuOption
                    iconClassName="mx_SpacePanel_iconExplore"
                    label={canAddRooms ? _t("space|context_menu|manage_and_explore") : _t("space|context_menu|explore")}
                    onClick={onExploreRoomsClick}
                />
                <IconizedContextMenuOption
                    iconClassName="mx_SpacePanel_iconPreferences"
                    label={_t("common|preferences")}
                    onClick={onPreferencesClick}
                />
                {devtoolsOption}
                {settingsOption}
                {leaveOption}
                {newRoomSection}
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>
    );
};

export default SpaceContextMenu;
