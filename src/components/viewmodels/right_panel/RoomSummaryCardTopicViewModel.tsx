/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type SyntheticEvent, useState } from "react";
import { EventType, type Room } from "matrix-js-sdk/src/matrix";

import { useRoomState } from "../../../hooks/useRoomState";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { onRoomTopicLinkClick } from "../../views/elements/RoomTopic";

export interface RoomTopicState {
    expanded: boolean;
    canEditTopic: boolean;
    onEditClick: (e: SyntheticEvent) => void;
    onExpandedClick: (ev: SyntheticEvent) => void;
    onTopicLinkClick: React.MouseEventHandler<HTMLElement>;
}

export function useRoomTopicViewModel(room: Room): RoomTopicState {
    const [expanded, setExpanded] = useState(true);

    const canEditTopic = useRoomState(room, (state) =>
        state.maySendStateEvent(EventType.RoomTopic, room.client.getSafeUserId()),
    );

    const onEditClick = (e: SyntheticEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        defaultDispatcher.dispatch({ action: "open_room_settings" });
    };

    const onExpandedClick = (e: SyntheticEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        setExpanded(!expanded);
    };

    const onTopicLinkClick = (e: React.MouseEvent): void => {
        if (e.target instanceof HTMLAnchorElement) {
            onRoomTopicLinkClick(e);
            return;
        }
    };

    return {
        expanded,
        canEditTopic,
        onEditClick,
        onExpandedClick,
        onTopicLinkClick,
    };
}
