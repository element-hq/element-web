/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel, type ComposeMenuSnapshot } from "@element-hq/web-shared-components";
import { RoomType, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import SpaceStore from "../../../stores/spaces/SpaceStore";
import { UPDATE_SELECTED_SPACE } from "../../../stores/spaces";
import { hasCreateRoomRights, createRoom as createRoomFunc } from "./utils";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import SettingsStore from "../../../settings/SettingsStore";
import { showCreateNewRoom } from "../../../utils/space";

interface ComposeMenuViewModelProps {
    client: MatrixClient;
}

/**
 * ViewModel for the ComposeMenu component.
 * Manages room creation actions.
 */
export class ComposeMenuViewModel extends BaseViewModel<ComposeMenuSnapshot, ComposeMenuViewModelProps> {
    private activeSpace: Room | null = null;

    public constructor(props: ComposeMenuViewModelProps) {
        super(props, ComposeMenuViewModel.createSnapshot(SpaceStore.instance.activeSpaceRoom, props.client));

        this.activeSpace = SpaceStore.instance.activeSpaceRoom;

        // Listen to space changes
        this.disposables.trackListener(SpaceStore.instance, UPDATE_SELECTED_SPACE as any, this.onSpaceChanged);
    }

    private static createSnapshot(activeSpace: Room | null, client: MatrixClient): ComposeMenuSnapshot {
        const canCreateRoom = hasCreateRoomRights(client, activeSpace);
        const canCreateVideoRoom = SettingsStore.getValue("feature_video_rooms") && canCreateRoom;

        return {
            canCreateRoom,
            canCreateVideoRoom,
            createChatRoom: ComposeMenuViewModel.createChatRoom,
            createRoom: () => ComposeMenuViewModel.createRoom(activeSpace),
            createVideoRoom: () => ComposeMenuViewModel.createVideoRoom(activeSpace),
        };
    }

    private onSpaceChanged = (): void => {
        this.activeSpace = SpaceStore.instance.activeSpaceRoom;
        
        const canCreateRoom = hasCreateRoomRights(this.props.client, this.activeSpace);
        const canCreateVideoRoom = SettingsStore.getValue("feature_video_rooms") && canCreateRoom;

        this.snapshot.merge({
            canCreateRoom,
            canCreateVideoRoom,
            createRoom: () => ComposeMenuViewModel.createRoom(this.activeSpace),
            createVideoRoom: () => ComposeMenuViewModel.createVideoRoom(this.activeSpace),
        });
    };

    private static createChatRoom = (): void => {
        defaultDispatcher.fire(Action.CreateChat);
    };

    private static createRoom = (activeSpace: Room | null): void => {
        createRoomFunc(activeSpace);
    };

    private static createVideoRoom = (activeSpace: Room | null): void => {
        const elementCallVideoRoomsEnabled = SettingsStore.getValue("feature_element_call_video_rooms");
        const type = elementCallVideoRoomsEnabled ? RoomType.UnstableCall : RoomType.ElementVideo;

        if (activeSpace) {
            showCreateNewRoom(activeSpace, type);
        } else {
            defaultDispatcher.dispatch({
                action: Action.CreateRoom,
                type,
            });
        }
    };
}
