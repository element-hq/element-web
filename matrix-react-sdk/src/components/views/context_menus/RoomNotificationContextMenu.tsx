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

import { Room } from "matrix-js-sdk/src/models/room";
import React from "react";

import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { useNotificationState } from "../../../hooks/useRoomNotificationState";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { _t } from "../../../languageHandler";
import { RoomNotifState } from "../../../RoomNotifs";
import { IProps as IContextMenuProps } from "../../structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuOptionList,
    IconizedContextMenuRadio,
} from "../context_menus/IconizedContextMenu";
import { ButtonEvent } from "../elements/AccessibleButton";

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
            label={_t("Match default setting")}
            active={notificationState === RoomNotifState.AllMessages}
            iconClassName="mx_RoomNotificationContextMenu_iconBell"
            onClick={wrapHandler(() => setNotificationState(RoomNotifState.AllMessages))}
        />
    );

    const allMessagesOption: JSX.Element = (
        <IconizedContextMenuRadio
            label={_t("All messages")}
            active={notificationState === RoomNotifState.AllMessagesLoud}
            iconClassName="mx_RoomNotificationContextMenu_iconBellDot"
            onClick={wrapHandler(() => setNotificationState(RoomNotifState.AllMessagesLoud))}
        />
    );

    const mentionsOption: JSX.Element = (
        <IconizedContextMenuRadio
            label={_t("Mentions & keywords")}
            active={notificationState === RoomNotifState.MentionsOnly}
            iconClassName="mx_RoomNotificationContextMenu_iconBellMentions"
            onClick={wrapHandler(() => setNotificationState(RoomNotifState.MentionsOnly))}
        />
    );

    const muteOption: JSX.Element = (
        <IconizedContextMenuRadio
            label={_t("Mute room")}
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
