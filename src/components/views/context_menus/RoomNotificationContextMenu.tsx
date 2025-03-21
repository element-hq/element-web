/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import React, { type JSX } from "react";

import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { useNotificationState } from "../../../hooks/useRoomNotificationState";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { _t } from "../../../languageHandler";
import { RoomNotifState } from "../../../RoomNotifs";
import { type IProps as IContextMenuProps } from "../../structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuOptionList,
    IconizedContextMenuRadio,
} from "../context_menus/IconizedContextMenu";
import { type ButtonEvent } from "../elements/AccessibleButton";

interface IProps extends IContextMenuProps {
    room: Room;
}

export const RoomNotificationContextMenu: React.FC<IProps> = ({ room, onFinished, ...props }) => {
    const [notificationState, setNotificationState] = useNotificationState(room);

    const wrapHandler = (handler: (ev: ButtonEvent) => void, persistent = false): ((ev: ButtonEvent) => void) => {
        return (ev: ButtonEvent) => {
            ev.preventDefault();
            ev.stopPropagation();

            handler(ev);

            const action = getKeyBindingsManager().getAccessibilityAction(ev as React.KeyboardEvent);
            if (!persistent || action === KeyBindingAction.Enter) {
                onFinished();
            }
        };
    };

    const defaultOption: JSX.Element = (
        <IconizedContextMenuRadio
            label={_t("room|context_menu|notifications_default")}
            active={notificationState === RoomNotifState.AllMessages}
            iconClassName="mx_RoomNotificationContextMenu_iconBell"
            onClick={wrapHandler(() => setNotificationState(RoomNotifState.AllMessages))}
        />
    );

    const allMessagesOption: JSX.Element = (
        <IconizedContextMenuRadio
            label={_t("notifications|all_messages")}
            active={notificationState === RoomNotifState.AllMessagesLoud}
            iconClassName="mx_RoomNotificationContextMenu_iconBellDot"
            onClick={wrapHandler(() => setNotificationState(RoomNotifState.AllMessagesLoud))}
        />
    );

    const mentionsOption: JSX.Element = (
        <IconizedContextMenuRadio
            label={_t("notifications|mentions_keywords")}
            active={notificationState === RoomNotifState.MentionsOnly}
            iconClassName="mx_RoomNotificationContextMenu_iconBellMentions"
            onClick={wrapHandler(() => setNotificationState(RoomNotifState.MentionsOnly))}
        />
    );

    const muteOption: JSX.Element = (
        <IconizedContextMenuRadio
            label={_t("room|context_menu|notifications_mute")}
            active={notificationState === RoomNotifState.Mute}
            iconClassName="mx_RoomNotificationContextMenu_iconBellCrossed"
            onClick={wrapHandler(() => setNotificationState(RoomNotifState.Mute))}
        />
    );

    return (
        <IconizedContextMenu {...props} onFinished={onFinished} className="mx_RoomNotificationContextMenu" compact>
            <IconizedContextMenuOptionList first>
                {defaultOption}
                {allMessagesOption}
                {mentionsOption}
                {muteOption}
            </IconizedContextMenuOptionList>
        </IconizedContextMenu>
    );
};
