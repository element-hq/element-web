/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { JoinRule, type MatrixClient, type Room, RoomEvent, RoomType } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type RoomListHeaderViewSnapshot,
    type RoomListHeaderViewModel as RoomListHeaderViewModelInterface,
    type SortOption,
} from "@element-hq/web-shared-components";

import defaultDispatcher from "../../dispatcher/dispatcher";
import PosthogTrackers from "../../PosthogTrackers";
import { Action } from "../../dispatcher/actions";
import { getMetaSpaceName, type MetaSpace, UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import { type SpaceStoreClass } from "../../stores/spaces/SpaceStore";
import {
    shouldShowSpaceSettings,
    showCreateNewRoom,
    showSpaceInvite,
    showSpacePreferences,
    showSpaceSettings,
} from "../../utils/space";
import type { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { createRoom, hasCreateRoomRights } from "../../components/viewmodels/roomlist/utils";
import SettingsStore from "../../settings/SettingsStore";
import RoomListStoreV3 from "../../stores/room-list-v3/RoomListStoreV3";
import { SortingAlgorithm } from "../../stores/room-list-v3/skip-list/sorters";
import { SettingLevel } from "../../settings/SettingLevel";

export interface Props {
    /**
     * The Matrix client instance.
     */
    matrixClient: MatrixClient;
    /**
     * The space store instance.
     */
    spaceStore: SpaceStoreClass;
}

/**
 * ViewModel for the RoomListHeader.
 * Manages the state and actions for the room list header.
 */
export class RoomListHeaderViewModel
    extends BaseViewModel<RoomListHeaderViewSnapshot, Props>
    implements RoomListHeaderViewModelInterface
{
    /**
     * Reference to the currently active space.
     * Used to manage event listeners.
     */
    private activeSpace: Room | null;

    public constructor(props: Props) {
        super(props, getInitialSnapshot(props.spaceStore, props.matrixClient));

        // Listen for video rooms feature flag changes
        const settingsFeatureVideoRef = SettingsStore.watchSetting(
            "feature_video_rooms",
            null,
            this.onVideoRoomsFeatureFlagChange,
        );
        this.disposables.track(() => SettingsStore.unwatchSetting(settingsFeatureVideoRef));

        // Listen for space changes
        this.disposables.trackListener(props.spaceStore, UPDATE_SELECTED_SPACE, this.onSpaceChange);
        this.disposables.trackListener(props.spaceStore, UPDATE_HOME_BEHAVIOUR, this.onHomeBehaviourChange);

        // Listen for space name changes
        this.activeSpace = props.spaceStore.activeSpaceRoom;
        if (this.activeSpace) {
            this.disposables.trackListener(this.activeSpace, RoomEvent.Name, this.onSpaceNameChange);
        }
    }

    /**
     * Handles space change events.
     */
    private readonly onSpaceChange = (): void => {
        const activeSpace = this.props.spaceStore.activeSpaceRoom;

        this.activeSpace?.off(RoomEvent.Name, this.onSpaceNameChange);
        this.activeSpace = activeSpace;

        // Add new room listener if needed
        if (this.activeSpace) {
            this.disposables.trackListener(this.activeSpace, RoomEvent.Name, this.onSpaceNameChange);
        }

        this.snapshot.merge({
            ...computeHeaderSpaceState(this.props.spaceStore, this.props.matrixClient),
        });
    };

    /**
     * Handles home behaviour change events.
     */
    private readonly onHomeBehaviourChange = (): void => {
        this.snapshot.merge({ title: getHeaderTitle(this.props.spaceStore) });
    };

    /**
     * Handles space name change events.
     */
    private onSpaceNameChange = (): void => {
        this.snapshot.merge({ title: getHeaderTitle(this.props.spaceStore) });
    };

    /**
     * Handles video rooms feature flag change events.
     */
    private readonly onVideoRoomsFeatureFlagChange = (): void => {
        this.snapshot.merge({
            canCreateVideoRoom: getCanCreateVideoRoom(this.snapshot.current.canCreateRoom),
        });
    };

    public createChatRoom = (e: Event): void => {
        defaultDispatcher.fire(Action.CreateChat);
        PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateChatItem", e);
    };

    public createRoom = (e: Event): void => {
        createRoom(this.activeSpace);
        PosthogTrackers.trackInteraction("WebRoomListHeaderPlusMenuCreateRoomItem", e);
    };

    public createVideoRoom = (): void => {
        const type = SettingsStore.getValue("feature_element_call_video_rooms")
            ? RoomType.UnstableCall
            : RoomType.ElementVideo;
        if (this.activeSpace) {
            showCreateNewRoom(this.activeSpace, type);
        } else {
            defaultDispatcher.dispatch({
                action: Action.CreateRoom,
                type,
            });
        }
    };

    public openSpaceHome = (): void => {
        if (!this.activeSpace) return;
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: this.activeSpace.roomId,
            metricsTrigger: undefined,
        });
    };

    public inviteInSpace = (): void => {
        if (!this.activeSpace) return;
        showSpaceInvite(this.activeSpace);
    };

    public openSpacePreferences = (): void => {
        if (!this.activeSpace) return;
        showSpacePreferences(this.activeSpace);
    };

    public openSpaceSettings = (): void => {
        if (!this.activeSpace) return;
        showSpaceSettings(this.activeSpace);
    };

    public sort = (option: SortOption): void => {
        let sortingAlgorithm: SortingAlgorithm;
        switch (option) {
            case "alphabetical":
                sortingAlgorithm = SortingAlgorithm.Alphabetic;
                break;
            case "recent":
                sortingAlgorithm = SortingAlgorithm.Recency;
                break;
            case "unread-first":
                sortingAlgorithm = SortingAlgorithm.Unread;
                break;
        }
        RoomListStoreV3.instance.resort(sortingAlgorithm);
        this.snapshot.merge({ activeSortOption: option });
    };

    public toggleMessagePreview = (): void => {
        PosthogTrackers.trackInteraction("WebRoomListMessagePreviewToggle");

        const isMessagePreviewEnabled = SettingsStore.getValue("RoomList.showMessagePreview");
        SettingsStore.setValue("RoomList.showMessagePreview", null, SettingLevel.DEVICE, !isMessagePreviewEnabled);
        this.snapshot.merge({ isMessagePreviewEnabled });
    };
}

/**
 * Get the initial snapshot for the RoomListHeaderViewModel.
 * @param spaceStore - The space store instance.
 * @param matrixClient - The Matrix client instance.
 * @returns
 */
function getInitialSnapshot(spaceStore: SpaceStoreClass, matrixClient: MatrixClient): RoomListHeaderViewSnapshot {
    const sortingAlgorithm = SettingsStore.getValue("RoomList.preferredSorting");

    let activeSortOption: SortOption;
    switch (sortingAlgorithm) {
        case SortingAlgorithm.Alphabetic:
            activeSortOption = "alphabetical";
            break;
        case SortingAlgorithm.Recency:
            activeSortOption = "recent";
            break;
        case SortingAlgorithm.Unread:
            activeSortOption = "unread-first";
            break;
    }

    const isMessagePreviewEnabled = SettingsStore.getValue("RoomList.showMessagePreview");

    return {
        activeSortOption,
        isMessagePreviewEnabled,
        ...computeHeaderSpaceState(spaceStore, matrixClient),
    };
}

/**
 * Get the header title based on the active space.
 * @param spaceStore - The space store instance.
 */
function getHeaderTitle(spaceStore: SpaceStoreClass): string {
    const activeSpace = spaceStore.activeSpaceRoom;
    const spaceName = activeSpace?.name;
    return spaceName ?? getMetaSpaceName(spaceStore.activeSpace as MetaSpace, spaceStore.allRoomsInHome);
}

/**
 * Determine if the user can create a video room.
 * @param canCreateRoom - Whether the user can create a room.
 */
function getCanCreateVideoRoom(canCreateRoom: boolean): boolean {
    return SettingsStore.getValue("feature_video_rooms") && canCreateRoom;
}

/**
 * Computes the header space state based on the active space and user permissions.
 * @param spaceStore - The space store instance.
 * @param matrixClient - The Matrix client instance.
 * @returns The header space state containing title, permissions, and display flags.
 */
function computeHeaderSpaceState(
    spaceStore: SpaceStoreClass,
    matrixClient: MatrixClient,
): Omit<RoomListHeaderViewSnapshot, "activeSortOption" | "isMessagePreviewEnabled"> {
    const activeSpace = spaceStore.activeSpaceRoom;
    const title = getHeaderTitle(spaceStore);

    const canCreateRoom = hasCreateRoomRights(matrixClient, activeSpace);
    const canCreateVideoRoom = getCanCreateVideoRoom(canCreateRoom);
    const displayComposeMenu = canCreateRoom;
    const displaySpaceMenu = Boolean(activeSpace);
    const canInviteInSpace = Boolean(
        activeSpace?.getJoinRule() === JoinRule.Public || activeSpace?.canInvite(matrixClient.getSafeUserId()),
    );
    const canAccessSpaceSettings = Boolean(activeSpace && shouldShowSpaceSettings(activeSpace));

    return {
        title,
        canCreateRoom,
        canCreateVideoRoom,
        displayComposeMenu,
        displaySpaceMenu,
        canInviteInSpace,
        canAccessSpaceSettings,
    };
}
