/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel, type RoomListSearchSnapshot } from "@element-hq/web-shared-components";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { MetaSpace } from "../../../stores/spaces";
import { Action } from "../../../dispatcher/actions";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../../LegacyCallHandler";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import { UPDATE_SELECTED_SPACE } from "../../../stores/spaces";

interface RoomListSearchViewModelProps {
    client: MatrixClient;
}

/**
 * ViewModel for the RoomListSearch component.
 * Manages search, explore, and dial pad buttons.
 */
export class RoomListSearchViewModel extends BaseViewModel<
    RoomListSearchSnapshot,
    RoomListSearchViewModelProps
> {
    public constructor(props: RoomListSearchViewModelProps) {
        super(props, RoomListSearchViewModel.createSnapshot());

        // Listen to space changes
        this.disposables.trackListener(SpaceStore.instance, UPDATE_SELECTED_SPACE as any, this.onSpaceChanged);

        // Listen to protocol support changes
        this.disposables.trackListener(LegacyCallHandler.instance, LegacyCallHandlerEvent.ProtocolSupport, this.onProtocolChanged);
    }

    private static createSnapshot(): RoomListSearchSnapshot {
        const activeSpace = SpaceStore.instance.activeSpace;
        const displayExploreButton = activeSpace === MetaSpace.Home && shouldShowComponent(UIComponent.ExploreRooms);
        const displayDialButton = LegacyCallHandler.instance.getSupportsPstnProtocol() ?? false;

        return {
            onSearchClick: RoomListSearchViewModel.onSearchClick,
            showDialPad: displayDialButton,
            onDialPadClick: displayDialButton ? RoomListSearchViewModel.onDialPadClick : undefined,
            showExplore: displayExploreButton,
            onExploreClick: displayExploreButton ? RoomListSearchViewModel.onExploreClick : undefined,
        };
    }

    private onSpaceChanged = (): void => {
        const activeSpace = SpaceStore.instance.activeSpace;
        const displayExploreButton = activeSpace === MetaSpace.Home && shouldShowComponent(UIComponent.ExploreRooms);
        
        this.snapshot.merge({
            showExplore: displayExploreButton,
            onExploreClick: displayExploreButton ? RoomListSearchViewModel.onExploreClick : undefined,
        });
    };

    private onProtocolChanged = (): void => {
        const displayDialButton = LegacyCallHandler.instance.getSupportsPstnProtocol() ?? false;
        
        this.snapshot.merge({
            showDialPad: displayDialButton,
            onDialPadClick: displayDialButton ? RoomListSearchViewModel.onDialPadClick : undefined,
        });
    };

    private static onSearchClick = (): void => {
        defaultDispatcher.fire(Action.OpenSpotlight);
    };

    private static onExploreClick = (): void => {
        defaultDispatcher.fire(Action.ViewRoomDirectory);
    };

    private static onDialPadClick = (): void => {
        defaultDispatcher.fire(Action.OpenDialPad);
    };
}
