/*
Copyright 2025 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { type SyntheticEvent, useState } from "react";
import { EventType, type Room, type ContentHelpers } from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";

import { useRoomState } from "../../../hooks/useRoomState";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { onRoomTopicLinkClick } from "../../views/elements/RoomTopic";
import { useTopic } from "../../../hooks/room/useTopic";

export interface RoomTopicState {
    /**
     * The topic of the room, the value is taken from the room state
     */
    topic: Optional<ContentHelpers.TopicState>;
    /**
     * Whether the topic is expanded or not
     */
    expanded: boolean;
    /**
     * Whether the user have the permission to edit the topic
     */
    canEditTopic: boolean;
    /**
     * The callback when the edit button is clicked
     */
    onEditClick: (e: SyntheticEvent) => void;
    /**
     * When the expand button is clicked, it changes expanded state
     */
    onExpandedClick: (ev: SyntheticEvent) => void;
    /**
     * The callback when the topic link is clicked
     */
    onTopicLinkClick: React.MouseEventHandler<HTMLElement>;
}

/**
 * The view model for the room topic used in the RoomSummaryCard
 * @param room - the room to get the topic from
 * @returns the room topic state
 */
export function useRoomTopicViewModel(room: Room): RoomTopicState {
    const [expanded, setExpanded] = useState(true);

    const topic = useTopic(room);

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
        setExpanded((_expanded) => !_expanded);
    };

    const onTopicLinkClick = (e: React.MouseEvent): void => {
        if (e.target instanceof HTMLAnchorElement) {
            onRoomTopicLinkClick(e);
            return;
        }
    };

    return {
        topic,
        expanded,
        canEditTopic,
        onEditClick,
        onExpandedClick,
        onTopicLinkClick,
    };
}
