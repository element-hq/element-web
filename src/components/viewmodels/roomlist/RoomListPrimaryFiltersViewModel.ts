/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel, type RoomListPrimaryFiltersSnapshot } from "@element-hq/web-shared-components";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";

import { FilterKey } from "../../../stores/room-list-v3/skip-list/filters";
import { _t, _td, type TranslationKey } from "../../../languageHandler";
import RoomListStoreV3, { RoomListStoreV3Event } from "../../../stores/room-list-v3/RoomListStoreV3";

interface RoomListPrimaryFiltersViewModelProps {
    client: MatrixClient;
}

const filterKeyToNameMap: Map<FilterKey, TranslationKey> = new Map([
    [FilterKey.UnreadFilter, _td("room_list|filters|unread")],
    [FilterKey.PeopleFilter, _td("room_list|filters|people")],
    [FilterKey.RoomsFilter, _td("room_list|filters|rooms")],
    [FilterKey.FavouriteFilter, _td("room_list|filters|favourite")],
    [FilterKey.MentionsFilter, _td("room_list|filters|mentions")],
    [FilterKey.InvitesFilter, _td("room_list|filters|invites")],
    [FilterKey.LowPriorityFilter, _td("room_list|filters|low_priority")],
]);

/**
 * ViewModel for the RoomListPrimaryFilters component.
 * Manages the primary filter pills above the room list.
 */
export class RoomListPrimaryFiltersViewModel extends BaseViewModel<
    RoomListPrimaryFiltersSnapshot,
    RoomListPrimaryFiltersViewModelProps
> {
    private activeFilter: FilterKey | undefined = undefined;
    private toggleCallback: ((key: FilterKey) => void) | undefined = undefined;

    public constructor(props: RoomListPrimaryFiltersViewModelProps) {
        super(props, RoomListPrimaryFiltersViewModel.createInitialSnapshot());

        // Listen to room list updates
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.ListsUpdate as any,
            this.onListsUpdate,
        );
    }

    private static createInitialSnapshot(): RoomListPrimaryFiltersSnapshot {
        const filters = [];

        for (const [key, name] of filterKeyToNameMap.entries()) {
            filters.push({
                name: _t(name),
                active: false,
                toggle: () => {}, // Will be set by setToggleCallback
            });
        }

        return { filters };
    }

    private createSnapshot(): RoomListPrimaryFiltersSnapshot {
        const filters = [];

        for (const [key, name] of filterKeyToNameMap.entries()) {
            filters.push({
                name: _t(name),
                active: this.activeFilter === key,
                toggle: () => this.toggleCallback?.(key),
            });
        }

        return { filters };
    }

    private onListsUpdate = (): void => {
        // Regenerate filters with current active state
        this.snapshot.set(this.createSnapshot());
    };

    public setToggleCallback(callback: (key: FilterKey) => void): void {
        this.toggleCallback = callback;
        this.snapshot.set(this.createSnapshot());
    }

    public setActiveFilter(filter: FilterKey | undefined): void {
        this.activeFilter = filter;
        this.snapshot.set(this.createSnapshot());
    }
}
