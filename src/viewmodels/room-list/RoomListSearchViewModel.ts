/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type React from "react";
import { ViewModelSubscriptions } from "../ViewModelSubscriptions";
import SpaceStore from "../../stores/spaces/SpaceStore";
import { MetaSpace, type SpaceKey, UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import {
    type RoomListSearchSnapshot,
    type RoomListSearchViewModel as RoomListSearchViewModelType,
} from "../../shared-components/room-list/RoomListSearch";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import { UIComponent } from "../../settings/UIFeature";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import PosthogTrackers from "../../PosthogTrackers";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";

/**
 * ViewModel for the RoomListSearch component.
 */
export class RoomListSearchViewModel implements RoomListSearchViewModelType {
    private subs: ViewModelSubscriptions;

    /**
     * The current snapshot of the RoomListSearch state.
     * It contains flags to determine whether to display the dial button and explore button.
     */
    private snapshot = {
        displayDialButton: false,
        displayExploreButton: false,
    };

    /**
     * Creates an instance of RoomListSearchViewModel.
     * It listens to SpaceStore and LegacyCallHandler events to update the snapshot.
     */
    public constructor() {
        this.subs = new ViewModelSubscriptions(this.updateSubscription);
    }

    private updateSubscription = (): void => {
        // Put the listener on the first time the subscription is called
        console.log("this.listeners.size", this.subs.listeners.size);
        if (this.subs.listeners.size > 0 && this.subs.listeners.size < 2) {
            SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.updateDisplayExploreButton);
            LegacyCallHandler.instance.on(LegacyCallHandlerEvent.ProtocolSupport, this.updateSupportPstn);

            this.updateDisplayExploreButton(SpaceStore.instance.activeSpace);
            this.updateSupportPstn();
        } else {
            SpaceStore.instance.off(UPDATE_SELECTED_SPACE, this.updateDisplayExploreButton);
            LegacyCallHandler.instance.off(LegacyCallHandlerEvent.ProtocolSupport, this.updateSupportPstn);
        }
    };

    /**
     * Update the displayExploreButton flag based on the active space.
     */
    private updateDisplayExploreButton = (activeSpace: SpaceKey): void => {
        this.snapshot.displayExploreButton =
            activeSpace === MetaSpace.Home && shouldShowComponent(UIComponent.ExploreRooms);
        this.subs.emit();
    };

    /**
     * Update the displayDialButton flag based on whether the PTSN protocol is supported.
     */
    private updateSupportPstn = (): void => {
        this.snapshot.displayDialButton = LegacyCallHandler.instance.getSupportsPstnProtocol();
        this.subs.emit();
    };

    public subscribe = (listener: () => void): (() => void) => {
        console.log("subscribing to RoomListSearchViewModel");
        return this.subs.subscribe(listener);
    };

    public getSnapshot = (): RoomListSearchSnapshot => {
        return this.snapshot;
    };

    /**
     * Open the dial pad when called.
     */
    public onDialPadClick(): void {
        defaultDispatcher.fire(Action.OpenDialPad);
    }

    /**
     * Open the room directory when called.
     */
    public onExploreClick(evt: React.MouseEvent<HTMLButtonElement>): void {
        defaultDispatcher.fire(Action.ViewRoomDirectory);
        PosthogTrackers.trackInteraction("WebLeftPanelExploreRoomsButton", evt);
    }

    /**
     * Open the spotlight when called.
     */
    public onSearchClick(): void {
        defaultDispatcher.fire(Action.OpenSpotlight);
    }
}
