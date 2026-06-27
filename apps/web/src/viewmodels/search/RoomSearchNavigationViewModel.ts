/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel } from "@element-hq/web-shared-components";

import { type SearchMatch } from "../../Searching";
import { SearchSessionStore, SearchSessionStoreEvent } from "../../stores/SearchSessionStore";

interface SearchMatchNavigationViewSnapshot {
    current: number;
    total: number;
    canPrevious: boolean;
    canNext: boolean;
}

interface SearchMatchNavigationViewActions {
    previous(): void;
    next(): void;
}

/**
 * Constructor props for {@link RoomSearchNavigationViewModel}.
 */
export interface RoomSearchNavigationProps {
    /**
     * Invoked when a match becomes the focused one (via next/previous). The owner is responsible for driving
     * the live timeline to the match (e.g. dispatching a ViewRoom action) and recording the active index.
     */
    onActivateMatch(this: void, match: SearchMatch, index: number): void;
}

function computeSnapshot(store: SearchSessionStore): SearchMatchNavigationViewSnapshot {
    const total = store.matches.length;
    const index = store.currentMatchIndex;
    return {
        current: index < 0 ? 0 : index + 1,
        total,
        // Stepping wraps around, so both arrows are available whenever there is at least one match.
        canPrevious: total > 0,
        canNext: total > 0,
    };
}

/**
 * MVVM-v2 view model owning the in-room search match cursor.
 *
 * The match list and focused index live in the {@link SearchSessionStore}; this view model is a thin reactive
 * projection of that store onto the "k of N" counter, and drives the live timeline through the injected
 * {@link RoomSearchNavigationProps.onActivateMatch} callback when the user steps with the up/down arrows.
 */
export class RoomSearchNavigationViewModel
    extends BaseViewModel<SearchMatchNavigationViewSnapshot, RoomSearchNavigationProps>
    implements SearchMatchNavigationViewActions
{
    private readonly store = SearchSessionStore.instance;

    public constructor(props: RoomSearchNavigationProps) {
        super(props, computeSnapshot(SearchSessionStore.instance));
        this.disposables.trackListener(this.store, SearchSessionStoreEvent.Update, this.onStoreUpdate);
    }

    private onStoreUpdate = (): void => {
        this.snapshot.set(computeSnapshot(this.store));
    };

    /**
     * Step to the next (older) match. From the empty cursor this activates the first (newest) match; from the
     * last match it wraps around to the first.
     */
    public readonly next = (): void => {
        const total = this.store.matches.length;
        if (total === 0) return;
        const index = this.store.currentMatchIndex;
        const nextIndex = index < 0 ? 0 : (index + 1) % total;
        this.activate(nextIndex);
    };

    /**
     * Step to the previous (newer) match. From the empty cursor or the first match this wraps around to the
     * last (oldest) match.
     */
    public readonly previous = (): void => {
        const total = this.store.matches.length;
        if (total === 0) return;
        const index = this.store.currentMatchIndex;
        const prevIndex = index <= 0 ? total - 1 : index - 1;
        this.activate(prevIndex);
    };

    private activate(index: number): void {
        // Flag the upcoming ViewRoom dispatch as a stepping jump to this match's event so RoomView's clear gates leave
        // the session alone, then move the cursor (which emits Update -> recomputes this snapshot via onStoreUpdate).
        this.store.beginSteppingJump(this.store.matches[index].eventId);
        this.store.setCurrentMatchIndex(index);
        this.props.onActivateMatch(this.store.matches[index], index);
    }
}
