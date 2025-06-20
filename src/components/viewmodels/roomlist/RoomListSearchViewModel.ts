/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useCallback, type MouseEvent } from "react";

import { type RoomListSearchActions, type RoomListSearchViewState } from "../../../shared/room-list/RoomListSearchView";
import { MetaSpace } from "../../../stores/spaces";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { useTypedEventEmitterState } from "../../../hooks/useEventEmitter";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../../LegacyCallHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import PosthogTrackers from "../../../PosthogTrackers";
import { Action } from "../../../dispatcher/actions";

export function useRoomListSearchViewModel(activeSpace: string): {
    viewState: RoomListSearchViewState;
    actions: RoomListSearchActions;
} {
    const displayExploreButton = activeSpace === MetaSpace.Home && shouldShowComponent(UIComponent.ExploreRooms);
    // We only display the dial button if the user is can make PSTN calls
    const displayDialButton = useTypedEventEmitterState(
        LegacyCallHandler.instance,
        LegacyCallHandlerEvent.ProtocolSupport,
        () => LegacyCallHandler.instance.getSupportsPstnProtocol(),
    );
    const viewState: RoomListSearchViewState = {
        displayDialButton,
        displayExploreButton,
    };

    const onSearchClick = useCallback(() => defaultDispatcher.fire(Action.OpenSpotlight), []);
    const onDialPadClick = useCallback(() => defaultDispatcher.fire(Action.OpenDialPad), []);
    const onExploreClick = useCallback((ev: MouseEvent) => {
        defaultDispatcher.fire(Action.ViewRoomDirectory);
        PosthogTrackers.trackInteraction("WebLeftPanelExploreRoomsButton", ev);
    }, []);
    const actions: RoomListSearchActions = {
        onSearchClick,
        onDialPadClick,
        onExploreClick,
    };

    return { viewState, actions };
}
