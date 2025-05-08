/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type Room } from "matrix-js-sdk/src/matrix";
import React, { type JSX, useContext } from "react";

import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import RoomListActions from "../../../actions/RoomListActions";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import dis from "../../../dispatcher/dispatcher";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { useUnreadNotifications } from "../../../hooks/useUnreadNotifications";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { _t } from "../../../languageHandler";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { DefaultTagID, type TagID } from "../../../stores/room-list/models";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../../stores/room-list/RoomListStore";
import DMRoomMap from "../../../utils/DMRoomMap";
import { clearRoomNotification, setMarkedUnreadState } from "../../../utils/notifications";
import { type IProps as IContextMenuProps } from "../../structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuCheckbox,
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import { type ButtonEvent } from "../elements/AccessibleButton";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { DeveloperToolsOption } from "./DeveloperToolsOption";
import { useSettingValue } from "../../../hooks/useSettings";

export interface RoomGeneralContextMenuProps extends IContextMenuProps {
    room: Room;
    /**
     * Called when the 'favourite' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostFavoriteClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'low priority' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostLowPriorityClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'invite' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostInviteClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'copy link' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostCopyLinkClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'settings' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostSettingsClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'forget room' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostForgetClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'leave' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostLeaveClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'mark as read' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostMarkAsReadClick?: (event: ButtonEvent) => void;
    /**
     * Called when the 'mark as unread' option is selected, after the menu has processed
     * the mouse or keyboard event.
     * @param event The event that caused the option to be selected.
     */
    onPostMarkAsUnreadClick?: (event: ButtonEvent) => void;
}

/**
 * Room context menu accessible via the room list.
 */
export const RoomGeneralContextMenu: React.FC<RoomGeneralContextMenuProps> = ({
    room,
    onFinished,
    onPostFavoriteClick,
    onPostLowPriorityClick,
    onPostInviteClick,
    onPostCopyLinkClick,
    onPostSettingsClick,
    onPostLeaveClick,
    onPostForgetClick,
    onPostMarkAsReadClick,
    onPostMarkAsUnreadClick,
    ...props
}) => {
    const cli = useContext(MatrixClientContext);
    const roomTags = useEventEmitterState(RoomListStore.instance, LISTS_UPDATE_EVENT, () =>
        RoomListStore.instance.getTagsForRoom(room),
    );
    const isDm = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    const wrapHandler = (
        handler: (ev: ButtonEvent) => void,
        postHandler?: (ev: ButtonEvent) => void,
        persistent = false,
    ): ((ev: ButtonEvent) => void) => {
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

    const onTagRoom = (ev: ButtonEvent, tagId: TagID): void => {
        if (!cli) return;
        if (tagId === DefaultTagID.Favourite || tagId === DefaultTagID.LowPriority) {
            const inverseTag = tagId === DefaultTagID.Favourite ? DefaultTagID.LowPriority : DefaultTagID.Favourite;
            const isApplied = RoomListStore.instance.getTagsForRoom(room).includes(tagId);
            const removeTag = isApplied ? tagId : inverseTag;
            const addTag = isApplied ? null : tagId;
            dis.dispatch(RoomListActions.tagRoom(cli, room, removeTag, addTag, 0));
        } else {
            logger.warn(`Unexpected tag ${tagId} applied to ${room.roomId}`);
        }
    };

    const isFavorite = roomTags.includes(DefaultTagID.Favourite);
    const favoriteOption: JSX.Element = (
        <IconizedContextMenuCheckbox
            onClick={wrapHandler((ev) => onTagRoom(ev, DefaultTagID.Favourite), onPostFavoriteClick, true)}
            active={isFavorite}
            label={isFavorite ? _t("room|context_menu|unfavourite") : _t("room|context_menu|favourite")}
            iconClassName="mx_RoomGeneralContextMenu_iconStar"
        />
    );

    const isLowPriority = roomTags.includes(DefaultTagID.LowPriority);
    const lowPriorityOption: JSX.Element = (
        <IconizedContextMenuCheckbox
            onClick={wrapHandler((ev) => onTagRoom(ev, DefaultTagID.LowPriority), onPostLowPriorityClick, true)}
            active={isLowPriority}
            label={_t("room|context_menu|low_priority")}
            iconClassName="mx_RoomGeneralContextMenu_iconArrowDown"
        />
    );

    let inviteOption: JSX.Element | null = null;
    if (room.canInvite(cli.getUserId()!) && !isDm && shouldShowComponent(UIComponent.InviteUsers)) {
        inviteOption = (
            <IconizedContextMenuOption
                onClick={wrapHandler(
                    () =>
                        dis.dispatch({
                            action: "view_invite",
                            roomId: room.roomId,
                        }),
                    onPostInviteClick,
                )}
                label={_t("action|invite")}
                iconClassName="mx_RoomGeneralContextMenu_iconInvite"
            />
        );
    }

    let copyLinkOption: JSX.Element | null = null;
    if (!isDm) {
        copyLinkOption = (
            <IconizedContextMenuOption
                onClick={wrapHandler(
                    () =>
                        dis.dispatch({
                            action: "copy_room",
                            room_id: room.roomId,
                        }),
                    onPostCopyLinkClick,
                )}
                label={_t("room|context_menu|copy_link")}
                iconClassName="mx_RoomGeneralContextMenu_iconCopyLink"
            />
        );
    }

    const settingsOption: JSX.Element = (
        <IconizedContextMenuOption
            onClick={wrapHandler(
                () =>
                    dis.dispatch({
                        action: "open_room_settings",
                        room_id: room.roomId,
                    }),
                onPostSettingsClick,
            )}
            label={_t("common|settings")}
            iconClassName="mx_RoomGeneralContextMenu_iconSettings"
        />
    );

    let leaveOption: JSX.Element;
    if (roomTags.includes(DefaultTagID.Archived)) {
        leaveOption = (
            <IconizedContextMenuOption
                iconClassName="mx_RoomGeneralContextMenu_iconSignOut"
                label={_t("room|context_menu|forget")}
                className="mx_IconizedContextMenu_option_red"
                onClick={wrapHandler(
                    () =>
                        dis.dispatch({
                            action: "forget_room",
                            room_id: room.roomId,
                        }),
                    onPostForgetClick,
                )}
            />
        );
    } else {
        leaveOption = (
            <IconizedContextMenuOption
                onClick={wrapHandler(
                    () =>
                        dis.dispatch({
                            action: "leave_room",
                            room_id: room.roomId,
                        }),
                    onPostLeaveClick,
                )}
                label={_t("action|leave")}
                className="mx_IconizedContextMenu_option_red"
                iconClassName="mx_RoomGeneralContextMenu_iconSignOut"
            />
        );
    }

    const { level } = useUnreadNotifications(room);
    const markAsReadOption: JSX.Element | null = (() => {
        if (level > NotificationLevel.None) {
            return (
                <IconizedContextMenuOption
                    onClick={wrapHandler(() => {
                        clearRoomNotification(room, cli);
                        onFinished?.();
                    }, onPostMarkAsReadClick)}
                    label={_t("room|context_menu|mark_read")}
                    iconClassName="mx_RoomGeneralContextMenu_iconMarkAsRead"
                />
            );
        } else if (!roomTags.includes(DefaultTagID.Archived)) {
            return (
                <IconizedContextMenuOption
                    onClick={wrapHandler(() => {
                        setMarkedUnreadState(room, cli, true);
                        onFinished?.();
                    }, onPostMarkAsUnreadClick)}
                    label={_t("room|context_menu|mark_unread")}
                    iconClassName="mx_RoomGeneralContextMenu_iconMarkAsUnread"
                />
            );
        } else {
            return null;
        }
    })();

    const developerModeEnabled = useSettingValue("developerMode");
    const developerToolsOption = developerModeEnabled ? (
        <DeveloperToolsOption onFinished={onFinished} roomId={room.roomId} />
    ) : null;

    return (
        <IconizedContextMenu {...props} onFinished={onFinished} className="mx_RoomGeneralContextMenu" compact>
            <IconizedContextMenuOptionList>
                {markAsReadOption}
                {!roomTags.includes(DefaultTagID.Archived) && (
                    <>
                        {favoriteOption}
                        {lowPriorityOption}
                        {inviteOption}
                        {copyLinkOption}
                        {settingsOption}
                    </>
                )}
                {developerToolsOption}
            </IconizedContextMenuOptionList>
            <IconizedContextMenuOptionList red>{leaveOption}</IconizedContextMenuOptionList>
        </IconizedContextMenu>
    );
};
