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

import { logger } from "matrix-js-sdk/src/logger";
import { Room } from "matrix-js-sdk/src/models/room";
import React, { useContext } from "react";

import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import RoomListActions from "../../../actions/RoomListActions";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import dis from "../../../dispatcher/dispatcher";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { _t } from "../../../languageHandler";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import DMRoomMap from "../../../utils/DMRoomMap";
import { IProps as IContextMenuProps } from "../../structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuCheckbox,
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import { ButtonEvent } from "../elements/AccessibleButton";

interface IProps extends IContextMenuProps {
    room: Room;
    onPostFavoriteClick?: (event: ButtonEvent) => void;
    onPostLowPriorityClick?: (event: ButtonEvent) => void;
    onPostInviteClick?: (event: ButtonEvent) => void;
    onPostCopyLinkClick?: (event: ButtonEvent) => void;
    onPostSettingsClick?: (event: ButtonEvent) => void;
    onPostForgetClick?: (event: ButtonEvent) => void;
    onPostLeaveClick?: (event: ButtonEvent) => void;
}

export const RoomGeneralContextMenu = ({
    room, onFinished,
    onPostFavoriteClick, onPostLowPriorityClick, onPostInviteClick, onPostCopyLinkClick, onPostSettingsClick,
    onPostLeaveClick, onPostForgetClick, ...props
}: IProps) => {
    const cli = useContext(MatrixClientContext);
    const roomTags = useEventEmitterState(
        RoomListStore.instance,
        LISTS_UPDATE_EVENT,
        () => RoomListStore.instance.getTagsForRoom(room),
    );
    const isDm = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    const wrapHandler = (
        handler: (ev: ButtonEvent) => void,
        postHandler?: (ev: ButtonEvent) => void,
        persistent = false,
    ): (ev: ButtonEvent) => void => {
        return (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            handler(ev);

            const action = getKeyBindingsManager().getAccessibilityAction(ev as React.KeyboardEvent);
            if (!persistent || action === KeyBindingAction.Enter) {
                onFinished();
            }
            postHandler?.(ev);
        };
    };

    const onTagRoom = (ev: ButtonEvent, tagId: TagID) => {
        if (tagId === DefaultTagID.Favourite || tagId === DefaultTagID.LowPriority) {
            const inverseTag = tagId === DefaultTagID.Favourite ? DefaultTagID.LowPriority : DefaultTagID.Favourite;
            const isApplied = RoomListStore.instance.getTagsForRoom(room).includes(tagId);
            const removeTag = isApplied ? tagId : inverseTag;
            const addTag = isApplied ? null : tagId;
            dis.dispatch(RoomListActions.tagRoom(cli, room, removeTag, addTag, undefined, 0));
        } else {
            logger.warn(`Unexpected tag ${tagId} applied to ${room.roomId}`);
        }
    };

    const isFavorite = roomTags.includes(DefaultTagID.Favourite);
    const favoriteOption: JSX.Element = <IconizedContextMenuCheckbox
        onClick={wrapHandler((ev) =>
            onTagRoom(ev, DefaultTagID.Favourite), onPostFavoriteClick, true)}
        active={isFavorite}
        label={isFavorite ? _t("Favourited") : _t("Favourite")}
        iconClassName="mx_RoomGeneralContextMenu_iconStar"
    />;

    const isLowPriority = roomTags.includes(DefaultTagID.LowPriority);
    const lowPriorityOption: JSX.Element = <IconizedContextMenuCheckbox
        onClick={wrapHandler((ev) =>
            onTagRoom(ev, DefaultTagID.LowPriority), onPostLowPriorityClick, true)}
        active={isLowPriority}
        label={_t("Low Priority")}
        iconClassName="mx_RoomGeneralContextMenu_iconArrowDown"
    />;

    let inviteOption: JSX.Element;
    if (room.canInvite(cli.getUserId()) && !isDm) {
        inviteOption = <IconizedContextMenuOption
            onClick={wrapHandler(() => dis.dispatch({
                action: "view_invite",
                roomId: room.roomId,
            }), onPostInviteClick)}
            label={_t("Invite")}
            iconClassName="mx_RoomGeneralContextMenu_iconInvite"
        />;
    }

    let copyLinkOption: JSX.Element;
    if (!isDm) {
        copyLinkOption = <IconizedContextMenuOption
            onClick={wrapHandler(() => dis.dispatch({
                action: "copy_room",
                room_id: room.roomId,
            }), onPostCopyLinkClick)}
            label={_t("Copy room link")}
            iconClassName="mx_RoomGeneralContextMenu_iconCopyLink"
        />;
    }

    const settingsOption: JSX.Element = <IconizedContextMenuOption
        onClick={wrapHandler(() => dis.dispatch({
            action: "open_room_settings",
            room_id: room.roomId,
        }), onPostSettingsClick)}
        label={_t("Settings")}
        iconClassName="mx_RoomGeneralContextMenu_iconSettings"
    />;

    let leaveOption: JSX.Element;
    if (roomTags.includes(DefaultTagID.Archived)) {
        leaveOption = <IconizedContextMenuOption
            iconClassName="mx_RoomGeneralContextMenu_iconSignOut"
            label={_t("Forget Room")}
            className="mx_IconizedContextMenu_option_red"
            onClick={wrapHandler(() => dis.dispatch({
                action: "forget_room",
                room_id: room.roomId,
            }), onPostForgetClick)}
        />;
    } else {
        leaveOption = <IconizedContextMenuOption
            onClick={wrapHandler(() => dis.dispatch({
                action: "leave_room",
                room_id: room.roomId,
            }), onPostLeaveClick)}
            label={_t("Leave")}
            className="mx_IconizedContextMenu_option_red"
            iconClassName="mx_RoomGeneralContextMenu_iconSignOut"
        />;
    }

    return <IconizedContextMenu
        {...props}
        onFinished={onFinished}
        className="mx_RoomGeneralContextMenu"
        compact
    >
        { !roomTags.includes(DefaultTagID.Archived) && (
            <IconizedContextMenuOptionList>
                { favoriteOption }
                { lowPriorityOption }
                { inviteOption }
                { copyLinkOption }
                { settingsOption }
            </IconizedContextMenuOptionList>
        ) }
        <IconizedContextMenuOptionList red>
            { leaveOption }
        </IconizedContextMenuOptionList>
    </IconizedContextMenu>;
};
