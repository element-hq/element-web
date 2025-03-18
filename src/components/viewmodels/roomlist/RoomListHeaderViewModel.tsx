/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback } from "react";
import { JoinRule, type Room, RoomEvent, RoomType } from "matrix-js-sdk/src/matrix";

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
import {
    shouldShowSpaceSettings,
    showCreateNewRoom,
    showSpaceInvite,
    showSpacePreferences,
    showSpaceSettings,
} from "../../../utils/space";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { createRoom, hasCreateRoomRights } from "./utils";

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
     * True if the user can create rooms
     */
    displayComposeMenu: boolean;
    /**
     * Whether to display the space menu
     * True if there is an active space
     */
    displaySpaceMenu: boolean;
    /**
     * Whether the user can create rooms
     */
    canCreateRoom: boolean;
    /**
     * Whether the user can create video rooms
     */
    canCreateVideoRoom: boolean;
    /**
     * Whether the user can invite in the active space
     */
    canInviteInSpace: boolean;
    /**
     * Whether the user can access space settings
     */
    canAccessSpaceSettings: boolean;
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
    /**
     * Open the active space home
     */
    openSpaceHome: () => void;
    /**
     * Display the space invite dialog
     */
    inviteInSpace: () => void;
    /**
     * Open the space preferences
     */
    openSpacePreferences: () => void;
    /**
     * Open the space settings
     */
    openSpaceSettings: () => void;
}

/**
 * View model for the RoomListHeader.
 */
export function useRoomListHeaderViewModel(): RoomListHeaderViewState {
    const matrixClient = useMatrixClientContext();
    const { activeSpace, title } = useSpace();
    const isSpaceRoom = Boolean(activeSpace);

    const canCreateRoom = hasCreateRoomRights(matrixClient, activeSpace);
    const canCreateVideoRoom = useFeatureEnabled("feature_video_rooms");
    const displayComposeMenu = canCreateRoom || canCreateVideoRoom;
    const displaySpaceMenu = isSpaceRoom;
    const canInviteInSpace = Boolean(
        activeSpace?.getJoinRule() === JoinRule.Public || activeSpace?.canInvite(matrixClient.getSafeUserId()),
    );
    const canAccessSpaceSettings = Boolean(activeSpace && shouldShowSpaceSettings(activeSpace));

    /* Actions */

    const createChatRoom = useCallback((e: Event) => {
        defaultDispatcher.fire(Action.CreateChat);
        PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateChatItem", e);
    }, []);

    const createRoomMemoized = useCallback(
        (e: Event) => {
            createRoom(activeSpace);
            PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateRoomItem", e);
        },
        [activeSpace],
    );

    const elementCallVideoRoomsEnabled = useFeatureEnabled("feature_element_call_video_rooms");
    const createVideoRoom = useCallback(() => {
        const type = elementCallVideoRoomsEnabled ? RoomType.UnstableCall : RoomType.ElementVideo;
        if (activeSpace) {
            showCreateNewRoom(activeSpace, type);
        } else {
            defaultDispatcher.dispatch({
                action: Action.CreateRoom,
                type,
            });
        }
    }, [activeSpace, elementCallVideoRoomsEnabled]);

    const openSpaceHome = useCallback(() => {
        // openSpaceHome is only available when there is an active space
        if (!activeSpace) return;
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: activeSpace.roomId,
            metricsTrigger: undefined,
        });
    }, [activeSpace]);

    const inviteInSpace = useCallback(() => {
        // inviteInSpace is only available when there is an active space
        if (!activeSpace) return;
        showSpaceInvite(activeSpace);
    }, [activeSpace]);

    const openSpacePreferences = useCallback(() => {
        // openSpacePreferences is only available when there is an active space
        if (!activeSpace) return;
        showSpacePreferences(activeSpace);
    }, [activeSpace]);

    const openSpaceSettings = useCallback(() => {
        // openSpaceSettings is only available when there is an active space
        if (!activeSpace) return;
        showSpaceSettings(activeSpace);
    }, [activeSpace]);

    return {
        title,
        displayComposeMenu,
        displaySpaceMenu,
        canCreateRoom,
        canCreateVideoRoom,
        canInviteInSpace,
        canAccessSpaceSettings,
        createChatRoom,
        createRoom: createRoomMemoized,
        createVideoRoom,
        openSpaceHome,
        inviteInSpace,
        openSpacePreferences,
        openSpaceSettings,
    };
}
