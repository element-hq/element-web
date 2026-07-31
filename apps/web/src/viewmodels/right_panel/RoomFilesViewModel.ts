/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel } from "@element-hq/web-shared-components";

import type { FileCategory } from "../../utils/FileCategory";

/**
 * Reactive state for the FilePanel's shared-media filters (search Phase 4): which media category is selected and
 * the search term. Both are pure view state — the actual event classification/filtering lives in pure helpers
 * ({@link buildFileEventFilter}) so the View stays dumb.
 */
export interface RoomFilesSnapshot {
    /** The selected media category, or `null` when no filter is applied and every media event shows. */
    activeCategory: FileCategory | null;
    /** The filename/caption search term (raw, untrimmed). */
    searchTerm: string;
}

/**
 * MVVM-v2 view model backing the FilePanel's media filter chips + search (search Phase 4 — "typed, searchable
 * shared-media tabs"). Holds only the category selection and search term; the {@link RoomFilesView} derives the
 * timeline display predicate from this snapshot.
 */
export class RoomFilesViewModel extends BaseViewModel<RoomFilesSnapshot, void> {
    public constructor() {
        super(undefined, { activeCategory: null, searchTerm: "" });
    }

    /**
     * Toggle a media category filter. Selecting the already-selected category clears the filter, so the panel
     * falls back to showing every media type.
     */
    public toggleCategory = (category: FileCategory): void => {
        this.snapshot.merge({ activeCategory: this.getSnapshot().activeCategory === category ? null : category });
    };

    /** Update the search term. */
    public setSearchTerm = (searchTerm: string): void => {
        this.snapshot.merge({ searchTerm });
    };
}
