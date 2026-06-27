/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { BaseViewModel } from "@element-hq/web-shared-components";

import { FileCategory } from "../../utils/FileCategory";

/**
 * Reactive state for the FilePanel's typed media tabs (search Phase 4): which tab is active and the in-tab search
 * term. Both are pure view state — the actual event classification/filtering lives in pure helpers
 * ({@link buildFileEventFilter}) so the View stays dumb.
 */
export interface RoomFilesSnapshot {
    /** The currently-selected media tab. */
    activeCategory: FileCategory;
    /** The in-tab filename/caption search term (raw, untrimmed). */
    searchTerm: string;
}

/**
 * MVVM-v2 view model backing the FilePanel's media tab bar + in-tab search (search Phase 4 — "typed, searchable
 * shared-media tabs"). Holds only the tab selection and search term; the {@link RoomFilesView} derives the timeline
 * display predicate from this snapshot.
 */
export class RoomFilesViewModel extends BaseViewModel<RoomFilesSnapshot, void> {
    public constructor() {
        super(undefined, { activeCategory: FileCategory.All, searchTerm: "" });
    }

    /** Switch the active media tab. */
    public setCategory = (activeCategory: FileCategory): void => {
        this.snapshot.merge({ activeCategory });
    };

    /** Update the in-tab search term. */
    public setSearchTerm = (searchTerm: string): void => {
        this.snapshot.merge({ searchTerm });
    };
}
