/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel, type SpaceMenuSnapshot } from "@element-hq/web-shared-components";
import { JoinRule, RoomEvent, type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import SpaceStore from "../../../stores/spaces/SpaceStore";
import { UPDATE_SELECTED_SPACE } from "../../../stores/spaces";
import { shouldShowSpaceSettings, showSpaceInvite, showSpacePreferences, showSpaceSettings } from "../../../utils/space";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";

interface SpaceMenuViewModelProps {
    client: MatrixClient;
}

/**
 * ViewModel for the SpaceMenu component.
 * Manages space-specific actions.
 */
export class SpaceMenuViewModel extends BaseViewModel<SpaceMenuSnapshot, SpaceMenuViewModelProps> {
    private activeSpace: Room | null = null;

    public constructor(props: SpaceMenuViewModelProps) {
        super(props, SpaceMenuViewModel.createSnapshot(SpaceStore.instance.activeSpaceRoom, props.client));

        this.activeSpace = SpaceStore.instance.activeSpaceRoom;

        // Listen to space changes
        this.disposables.trackListener(SpaceStore.instance, UPDATE_SELECTED_SPACE as any, this.onSpaceChanged);

        // Listen to room name changes if there's an active space
        if (this.activeSpace) {
            this.disposables.trackListener(this.activeSpace, RoomEvent.Name, this.onRoomNameChanged);
        }
    }

    private static createSnapshot(activeSpace: Room | null, client: MatrixClient): SpaceMenuSnapshot {
        const title = activeSpace?.name ?? "";
        const canInviteInSpace = Boolean(
            activeSpace?.getJoinRule() === JoinRule.Public || activeSpace?.canInvite(client.getSafeUserId()),
        );
        const canAccessSpaceSettings = Boolean(activeSpace && shouldShowSpaceSettings(activeSpace));

        return {
            title,
            canInviteInSpace,
            canAccessSpaceSettings,
            openSpaceHome: () => SpaceMenuViewModel.openSpaceHome(activeSpace),
            inviteInSpace: () => SpaceMenuViewModel.inviteInSpace(activeSpace),
            openSpacePreferences: () => SpaceMenuViewModel.openSpacePreferences(activeSpace),
            openSpaceSettings: () => SpaceMenuViewModel.openSpaceSettings(activeSpace),
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

        const title = this.activeSpace?.name ?? "";
        const canInviteInSpace = Boolean(
            this.activeSpace?.getJoinRule() === JoinRule.Public || this.activeSpace?.canInvite(this.props.client.getSafeUserId()),
        );
        const canAccessSpaceSettings = Boolean(this.activeSpace && shouldShowSpaceSettings(this.activeSpace));

        this.snapshot.merge({
            title,
            canInviteInSpace,
            canAccessSpaceSettings,
            openSpaceHome: () => SpaceMenuViewModel.openSpaceHome(this.activeSpace),
            inviteInSpace: () => SpaceMenuViewModel.inviteInSpace(this.activeSpace),
            openSpacePreferences: () => SpaceMenuViewModel.openSpacePreferences(this.activeSpace),
            openSpaceSettings: () => SpaceMenuViewModel.openSpaceSettings(this.activeSpace),
        });
    };

    private onRoomNameChanged = (): void => {
        if (this.activeSpace) {
            this.snapshot.merge({ title: this.activeSpace.name });
        }
    };

    private static openSpaceHome = (activeSpace: Room | null): void => {
        if (!activeSpace) return;
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: activeSpace.roomId,
            metricsTrigger: undefined,
        });
    };

    private static inviteInSpace = (activeSpace: Room | null): void => {
        if (!activeSpace) return;
        showSpaceInvite(activeSpace);
    };

    private static openSpacePreferences = (activeSpace: Room | null): void => {
        if (!activeSpace) return;
        showSpacePreferences(activeSpace);
    };

    private static openSpaceSettings = (activeSpace: Room | null): void => {
        if (!activeSpace) return;
        showSpaceSettings(activeSpace);
    };
}
