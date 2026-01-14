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

export interface Props {
    /**
     * The Matrix client instance.
     */
    matrixClient: MatrixClient;
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

    /**
     * Computes the snapshot based on the current state.
     */
    private static readonly computeSnapshot = ({ matrixClient, spaceStore }: Props): RoomListHeaderViewSnapshot => {
        const activeSpace = spaceStore.activeSpaceRoom;
        const spaceName = activeSpace?.name;
        const title = spaceName ?? getMetaSpaceName(spaceStore.activeSpace as MetaSpace, spaceStore.allRoomsInHome);

        const canCreateRoom = hasCreateRoomRights(matrixClient, activeSpace);
        const canCreateVideoRoom = SettingsStore.getValue("feature_video_rooms") && canCreateRoom;
        const displayComposeMenu = canCreateRoom;
        const displaySpaceMenu = Boolean(activeSpace);
        const canInviteInSpace = Boolean(
            activeSpace?.getJoinRule() === JoinRule.Public || activeSpace?.canInvite(matrixClient.getSafeUserId()),
        );
        const canAccessSpaceSettings = Boolean(activeSpace && shouldShowSpaceSettings(activeSpace));

        const sortingAlgorithm = SettingsStore.getValue("RoomList.preferredSorting");
        const activeSortOption =
            sortingAlgorithm === SortingAlgorithm.Recency ? ("recent" as const) : ("alphabetical" as const);

        return {
            title,
            displayComposeMenu,
            displaySpaceMenu,
            canCreateRoom,
            canCreateVideoRoom,
            canInviteInSpace,
            canAccessSpaceSettings,
            activeSortOption,
        };
    };

    public constructor(props: Props) {
        super(props, RoomListHeaderViewModel.computeSnapshot(props));

        // Listen for video rooms feature flag changes
        const settingsFeatureVideoRef = SettingsStore.watchSetting("feature_video_rooms", null, this.updateSnapshot);
        this.disposables.track(() => SettingsStore.unwatchSetting(settingsFeatureVideoRef));

        // Listen for space changes
        this.disposables.trackListener(props.spaceStore, UPDATE_SELECTED_SPACE, this.onSpaceChange);
        this.disposables.trackListener(props.spaceStore, UPDATE_HOME_BEHAVIOUR, this.onHomeBehaviourChange);

        // Listen for space name changes
        this.activeSpace = props.spaceStore.activeSpaceRoom;
        if (this.activeSpace) {
            this.disposables.trackListener(this.activeSpace, RoomEvent.Name, this.updateSnapshot);
        }
    }

    /**
     * Handles space change events.
     */
    private readonly onSpaceChange = (): void => {
        const activeSpace = this.props.spaceStore.activeSpaceRoom;

        this.activeSpace?.off(RoomEvent.Name, this.updateSnapshot);
        this.activeSpace = activeSpace;

        // Add new room listener if needed
        if (this.activeSpace) {
            this.disposables.trackListener(this.activeSpace, RoomEvent.Name, this.updateSnapshot);
        }

        this.updateSnapshot();
    };

    /**
     * Handles home behaviour change events.
     */
    private readonly onHomeBehaviourChange = (): void => {
        this.updateSnapshot();
    };

    /**
     * Updates the snapshot.
     */
    private readonly updateSnapshot = (): void => {
        this.snapshot.set(RoomListHeaderViewModel.computeSnapshot(this.props));
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
        const sortingAlgorithm = option === "recent" ? SortingAlgorithm.Recency : SortingAlgorithm.Alphabetic;
        RoomListStoreV3.instance.resort(sortingAlgorithm);
        this.updateSnapshot();
    };
}
