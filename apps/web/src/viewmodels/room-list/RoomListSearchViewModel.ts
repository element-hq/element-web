/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MouseEvent } from "react";
import {
    BaseViewModel,
    type RoomListSearchViewSnapshot,
    type RoomListSearchViewModel as RoomListSearchViewModelInterface,
} from "@element-hq/web-shared-components";

import { IS_MAC, Key } from "../../Keyboard";
import { _t } from "../../languageHandler";
import { ALTERNATE_KEY_NAME } from "../../accessibility/KeyboardShortcuts";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import { UIComponent } from "../../settings/UIFeature";
import { MetaSpace } from "../../stores/spaces";
import { Action } from "../../dispatcher/actions";
import PosthogTrackers from "../../PosthogTrackers";
import defaultDispatcher from "../../dispatcher/dispatcher";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";

export interface Props {
    /**
     * Current active space
     * The explore button is only displayed in the Home meta space
     */
    activeSpace: string;
}

/**
 * ViewModel for the room list search component.
 * Manages the state and actions for the search bar, dial pad, and explore buttons.
 */
export class RoomListSearchViewModel
    extends BaseViewModel<RoomListSearchViewSnapshot, Props>
    implements RoomListSearchViewModelInterface
{
    private displayDialButton = false;

    /**
     * Computes the snapshot based on the current props and PSTN support state.
     */
    private static readonly computeSnapshot = (
        activeSpace: string,
        supportsPstn: boolean,
    ): RoomListSearchViewSnapshot => {
        const displayExploreButton = activeSpace === MetaSpace.Home && shouldShowComponent(UIComponent.ExploreRooms);
        const searchShortcut = IS_MAC ? "⌘ K" : _t(ALTERNATE_KEY_NAME[Key.CONTROL]) + " K";
        return {
            displayExploreButton,
            displayDialButton: supportsPstn,
            searchShortcut,
        };
    };

    public constructor(props: Props) {
        const supportsPstn = LegacyCallHandler.instance.getSupportsPstnProtocol();
        super(props, RoomListSearchViewModel.computeSnapshot(props.activeSpace, supportsPstn));
        this.displayDialButton = supportsPstn;

        // Listen for changes in PSTN protocol support
        this.disposables.trackListener(
            LegacyCallHandler.instance,
            LegacyCallHandlerEvent.ProtocolSupport,
            this.onProtocolSupportChange,
        );
    }

    /**
     * Handles changes in protocol support (PSTN).
     */
    private readonly onProtocolSupportChange = (): void => {
        const supportsPstn = LegacyCallHandler.instance.getSupportsPstnProtocol();
        this.displayDialButton = supportsPstn;
        this.snapshot.set(RoomListSearchViewModel.computeSnapshot(this.props.activeSpace, supportsPstn));
    };

    /**
     * Handles the search button click event.
     * Opens the spotlight search dialog.
     */
    public onSearchClick = (): void => {
        defaultDispatcher.fire(Action.OpenSpotlight);
    };

    /**
     * Handles the dial pad button click event.
     * Opens the dial pad dialog.
     */
    public onDialPadClick = (): void => {
        defaultDispatcher.fire(Action.OpenDialPad);
    };

    /**
     * Handles the explore button click event.
     * Opens the room directory and tracks the interaction.
     */
    public onExploreClick = (ev: MouseEvent<HTMLButtonElement>): void => {
        defaultDispatcher.fire(Action.ViewRoomDirectory);
        PosthogTrackers.trackInteraction("WebLeftPanelExploreRoomsButton", ev);
    };

    /**
     * Sets the active space and updates the snapshot accordingly.
     * @param activeSpace - The new active space ID.
     */
    public setActiveSpace(activeSpace: string): void {
        if (activeSpace === this.props.activeSpace) return;

        this.props.activeSpace = activeSpace;
        this.snapshot.set(RoomListSearchViewModel.computeSnapshot(activeSpace, this.displayDialButton));
    }
}
