/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback } from "react";
import { type Room, RoomEvent, RoomType } from "matrix-js-sdk/src/matrix";

import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import PosthogTrackers from "../../../PosthogTrackers";
import { Action } from "../../../dispatcher/actions";
import { useEventEmitterState, useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import {
    getMetaSpaceName,
    type MetaSpace,
    type SpaceKey,
    UPDATE_HOME_BEHAVIOUR,
    UPDATE_SELECTED_SPACE,
} from "../../../stores/spaces";
import SpaceStore from "../../../stores/spaces/SpaceStore";

/**
 * Hook to get the active space and its title.
 */
function useSpace(): { activeSpace: Room | null; title: string } {
    const [spaceKey, activeSpace] = useEventEmitterState<[SpaceKey, Room | null]>(
        SpaceStore.instance,
        UPDATE_SELECTED_SPACE,
        () => [SpaceStore.instance.activeSpace, SpaceStore.instance.activeSpaceRoom],
    );
    const spaceName = useTypedEventEmitterState(activeSpace ?? undefined, RoomEvent.Name, () => activeSpace?.name);
    const allRoomsInHome = useEventEmitterState(
        SpaceStore.instance,
        UPDATE_HOME_BEHAVIOUR,
        () => SpaceStore.instance.allRoomsInHome,
    );

    const title = spaceName ?? getMetaSpaceName(spaceKey as MetaSpace, allRoomsInHome);

    return {
        activeSpace,
        title,
    };
}

export interface RoomListHeaderViewState {
    /**
     * The title of the room list
     */
    title: string;
    /**
     * Whether to display the compose menu
     * True if the user can create rooms and is not in a Space
     */
    displayComposeMenu: boolean;
    /**
     * Whether the user can create rooms
     */
    canCreateRoom: boolean;
    /**
     * Whether the user can create video rooms
     */
    canCreateVideoRoom: boolean;
    /**
     * Create a chat room
     * @param e - The click event
     */
    createChatRoom: (e: Event) => void;
    /**
     * Create a room
     * @param e - The click event
     */
    createRoom: (e: Event) => void;
    /**
     * Create a video room
     */
    createVideoRoom: () => void;
}

/**
 * View model for the RoomListHeader.
 * The actions don't work when called in a space yet.
 */
export function useRoomListHeaderViewModel(): RoomListHeaderViewState {
    const { activeSpace, title } = useSpace();

    const canCreateRoom = shouldShowComponent(UIComponent.CreateRooms);
    const canCreateVideoRoom = useFeatureEnabled("feature_video_rooms");
    // Temporary: don't display the compose menu when in a Space
    const displayComposeMenu = canCreateRoom && !activeSpace;

    /* Actions */

    const createChatRoom = useCallback((e: Event) => {
        defaultDispatcher.fire(Action.CreateChat);
        PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateChatItem", e);
    }, []);

    const createRoom = useCallback((e: Event) => {
        defaultDispatcher.fire(Action.CreateRoom);
        PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateRoomItem", e);
    }, []);

    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms");
    const createVideoRoom = useCallback(
        () =>
            defaultDispatcher.dispatch({
                action: Action.CreateRoom,
                type: elementCallVideoRoomsEnabled ? RoomType.UnstableCall : RoomType.ElementVideo,
            }),
        [elementCallVideoRoomsEnabled],
    );

    return {
        title,
        displayComposeMenu,
        canCreateRoom,
        canCreateVideoRoom,
        createChatRoom,
        createRoom,
        createVideoRoom,
    };
}
