/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel, type RoomListHeaderSnapshot } from "@element-hq/web-shared-components";
import { RoomEvent, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import SpaceStore from "../../../stores/spaces/SpaceStore";
import { getMetaSpaceName, type MetaSpace, type SpaceKey, UPDATE_HOME_BEHAVIOUR, UPDATE_SELECTED_SPACE } from "../../../stores/spaces";
import { hasCreateRoomRights } from "./utils";
import { SortOptionsMenuViewModel } from "./SortOptionsMenuViewModel";
import { SpaceMenuViewModel } from "./SpaceMenuViewModel";
import { ComposeMenuViewModel } from "./ComposeMenuViewModel";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";

interface RoomListHeaderViewModelProps {
    client: MatrixClient;
}

/**
 * ViewModel for the RoomListHeader component.
 * Manages header display and actions.
 */
export class RoomListHeaderViewModel extends BaseViewModel<
    RoomListHeaderSnapshot,
    RoomListHeaderViewModelProps
> {
    private activeSpace: Room | null = null;
    private sortOptionsMenuVm: SortOptionsMenuViewModel;
    private spaceMenuVm: SpaceMenuViewModel;
    private composeMenuVm: ComposeMenuViewModel;

    public constructor(props: RoomListHeaderViewModelProps) {
        const activeSpace = SpaceStore.instance.activeSpaceRoom;
        
        // Create child ViewModels
        const sortOptionsMenuVm = new SortOptionsMenuViewModel({ client: props.client });
        const spaceMenuVm = new SpaceMenuViewModel({ client: props.client });
        const composeMenuVm = new ComposeMenuViewModel({ client: props.client });

        super(props, RoomListHeaderViewModel.createSnapshot(
            SpaceStore.instance.activeSpace,
            activeSpace,
            SpaceStore.instance.allRoomsInHome,
            props.client,
            sortOptionsMenuVm,
            spaceMenuVm,
            composeMenuVm,
        ));

        this.activeSpace = activeSpace;
        this.sortOptionsMenuVm = sortOptionsMenuVm;
        this.spaceMenuVm = spaceMenuVm;
        this.composeMenuVm = composeMenuVm;

        // Listen to space changes
        this.disposables.trackListener(SpaceStore.instance, UPDATE_SELECTED_SPACE as any, this.onSpaceChanged);
        this.disposables.trackListener(SpaceStore.instance, UPDATE_HOME_BEHAVIOUR as any, this.onHomeBehaviourChanged);

        // Listen to room name changes if there's an active space
        if (this.activeSpace) {
            this.disposables.trackListener(this.activeSpace, RoomEvent.Name, this.onRoomNameChanged);
        }
    }

    private static createSnapshot(
        spaceKey: SpaceKey,
        activeSpace: Room | null,
        allRoomsInHome: boolean,
        client: MatrixClient,
        sortOptionsMenuVm: SortOptionsMenuViewModel,
        spaceMenuVm: SpaceMenuViewModel,
        composeMenuVm: ComposeMenuViewModel,
    ): RoomListHeaderSnapshot {
        const spaceName = activeSpace?.name;
        const title = spaceName ?? getMetaSpaceName(spaceKey as MetaSpace, allRoomsInHome);
        const isSpace = Boolean(activeSpace);
        const canCreateRoom = hasCreateRoomRights(client, activeSpace);
        const displayComposeMenu = canCreateRoom;

        return {
            title,
            isSpace,
            spaceMenuVm: isSpace ? spaceMenuVm : undefined,
            displayComposeMenu,
            composeMenuVm: displayComposeMenu ? composeMenuVm : undefined,
            onComposeClick: !displayComposeMenu ? RoomListHeaderViewModel.createChatRoom : undefined,
            sortOptionsMenuVm,
        };
    }

    private onSpaceChanged = (): void => {
        // Remove listener from old space
        if (this.activeSpace) {
            this.activeSpace.off(RoomEvent.Name, this.onRoomNameChanged);
        }

        this.activeSpace = SpaceStore.instance.activeSpaceRoom;

        // Add listener to new space
        if (this.activeSpace) {
            this.disposables.trackListener(this.activeSpace, RoomEvent.Name, this.onRoomNameChanged);
        }

        const spaceKey = SpaceStore.instance.activeSpace;
        const spaceName = this.activeSpace?.name;
        const title = spaceName ?? getMetaSpaceName(spaceKey as MetaSpace, SpaceStore.instance.allRoomsInHome);
        const isSpace = Boolean(this.activeSpace);
        const canCreateRoom = hasCreateRoomRights(this.props.client, this.activeSpace);
        const displayComposeMenu = canCreateRoom;

        this.snapshot.merge({
            title,
            isSpace,
            spaceMenuVm: isSpace ? this.spaceMenuVm : undefined,
            displayComposeMenu,
            composeMenuVm: displayComposeMenu ? this.composeMenuVm : undefined,
            onComposeClick: !displayComposeMenu ? RoomListHeaderViewModel.createChatRoom : undefined,
        });
    };

    private onHomeBehaviourChanged = (): void => {
        const spaceKey = SpaceStore.instance.activeSpace;
        const spaceName = this.activeSpace?.name;
        const title = spaceName ?? getMetaSpaceName(spaceKey as MetaSpace, SpaceStore.instance.allRoomsInHome);
        this.snapshot.merge({ title });
    };

    private onRoomNameChanged = (): void => {
        if (this.activeSpace) {
            this.snapshot.merge({ title: this.activeSpace.name });
        }
    };

    private static createChatRoom = (): void => {
        defaultDispatcher.fire(Action.CreateChat);
    };

    public override dispose(): void {
        this.sortOptionsMenuVm.dispose();
        this.spaceMenuVm.dispose();
        this.composeMenuVm.dispose();
        super.dispose();
    }
}
