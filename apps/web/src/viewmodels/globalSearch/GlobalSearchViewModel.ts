/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { BaseViewModel } from "@element-hq/web-shared-components";
import { Action } from "../../dispatcher/actions";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { SettingLevel } from "../../settings/SettingLevel";
import SettingsStore from "../../settings/SettingsStore";
import { startDmOnFirstMessage } from "../../utils/direct-messages";
import { filterBoolean } from "../../utils/arrays";
import { GlobalSearchFilter, type PersonResult } from "../../hooks/useGlobalSearch";
import { transformSearchTerm } from "../../utils/SearchInput";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RECENT_SEARCHES = 10;
const RECENT_SEARCHES_SETTING = "SpotlightSearch.recentSearches";

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface GlobalSearchViewSnapshot {
    /** Current search query */
    query: string;
    /** Active filter */
    filter: GlobalSearchFilter;
    /** Whether the full-view panel is open (vs. dropdown) */
    isFullView: boolean;
    /** Recently searched rooms */
    recentSearches: Room[];
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GlobalSearchViewModelProps {
    /** Initial query text, e.g. passed from a keyboard shortcut handler */
    initialText?: string;
    /** Initial filter */
    initialFilter?: GlobalSearchFilter;
    /** Called when the panel should close */
    onClose: () => void;
}

// ── ViewModel ─────────────────────────────────────────────────────────────────

export class GlobalSearchViewModel extends BaseViewModel<GlobalSearchViewSnapshot, GlobalSearchViewModelProps> {
    public constructor(props: GlobalSearchViewModelProps) {
        super(props, {
            query: props.initialText ?? "",
            filter: props.initialFilter ?? GlobalSearchFilter.All,
            isFullView: false,
            recentSearches: GlobalSearchViewModel.loadRecentSearches(),
        });
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static loadRecentSearches(): Room[] {
        const cli = MatrixClientPeg.safeGet();
        const recents = SettingsStore.getValue(RECENT_SEARCHES_SETTING, null) as string[];
        return filterBoolean(recents.map((id) => cli.getRoom(id)));
    }

    private persistRecentSearch(roomId: string): void {
        const recents = new Set(
            (SettingsStore.getValue(RECENT_SEARCHES_SETTING, null) as string[]).reverse(),
        );
        recents.delete(roomId);
        recents.add(roomId);

        const updated = Array.from(recents).reverse().slice(0, MAX_RECENT_SEARCHES);
        SettingsStore.setValue(RECENT_SEARCHES_SETTING, null, SettingLevel.ACCOUNT, updated);
        this.snapshot.merge({ recentSearches: GlobalSearchViewModel.loadRecentSearches() });
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    /** Update the search query */
    public onQueryChange = (query: string): void => {
        this.snapshot.merge({ query: transformSearchTerm(query) });
    };

    /** Update the active filter */
    public onFilterChange = (filter: GlobalSearchFilter): void => {
        this.snapshot.merge({ filter });
    };

    /** Expand to the full-view panel */
    public onExpandToFullView = (): void => {
        this.snapshot.merge({ isFullView: true });
    };

    /** Collapse back to dropdown */
    public onCollapseToDropdown = (): void => {
        this.snapshot.merge({ isFullView: false });
    };

    /** Navigate to a room and close the panel */
    public onRoomClick = (roomId: string): void => {
        this.persistRecentSearch(roomId);
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "WebUnifiedSearch",
            metricsViaKeyboard: false,
        });
        this.props.onClose();
    };

    /** Start or open a DM with a person and close the panel */
    public onPersonClick = (result: PersonResult): void => {
        if (result.dmRoom) {
            this.onRoomClick(result.dmRoom.roomId);
        } else {
            const cli = MatrixClientPeg.safeGet();
            startDmOnFirstMessage(cli, [result.member]);
            this.props.onClose();
        }
    };

    /** Clear recent searches */
    public onClearRecentSearches = (): void => {
        SettingsStore.setValue(RECENT_SEARCHES_SETTING, null, SettingLevel.ACCOUNT, []);
        this.snapshot.merge({ recentSearches: [] });
    };

    /** Close the panel */
    public onClose = (): void => {
        this.props.onClose();
    };
}
