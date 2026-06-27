/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type KeyboardEvent, type ReactNode, useMemo, useRef } from "react";
import { type EventTimelineSet, type TimelineWindow } from "matrix-js-sdk/src/matrix";
import { ChatFilter, Form, Search } from "@vector-im/compound-web";
import { Flex, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { Layout } from "../../../settings/enums/Layout";
import TimelinePanel from "../../structures/TimelinePanel";
import { EventPresentationContextProvider } from "../../../utils/EventPresentationContextProvider";
import { RoomFilesViewModel } from "../../../viewmodels/right_panel/RoomFilesViewModel";
import { buildFileEventFilter, FILE_CATEGORY_TABS, FileCategory } from "../../../utils/FileCategory";

interface Props {
    /** The filtered (files/media) timeline set built by {@link FilePanel}. */
    timelineSet: EventTimelineSet;
    /**
     * Pagination override (Seshat-backed for encrypted rooms), forwarded straight to TimelinePanel. Declared with
     * method syntax to mirror TimelinePanel's bivariant signature, so FilePanel's `Direction`-typed handler is
     * assignable.
     */
    onPaginationRequest(this: void, timelineWindow: TimelineWindow, direction: string, size: number): Promise<boolean>;
    /** Empty-state node rendered when the (filtered) timeline has nothing to show. */
    empty: ReactNode;
}

const TAB_LABELS: Record<FileCategory, TranslationKey> = {
    [FileCategory.All]: "file_panel|tab_all",
    [FileCategory.Media]: "file_panel|tab_media",
    [FileCategory.Files]: "file_panel|tab_files",
    [FileCategory.Music]: "file_panel|tab_music",
    [FileCategory.Voice]: "file_panel|tab_voice",
};

/**
 * The body of the FilePanel: a Telegram-style row of typed media tabs (All / Media / Files / Music / Voice) plus an
 * in-tab filename/caption search, driving a {@link TimelinePanel} over the room's shared-media timeline (search
 * Phase 4).
 *
 * MVVM v2: tab selection + search term live in {@link RoomFilesViewModel}; the timeline display predicate is derived
 * from the snapshot via the pure {@link buildFileEventFilter} and handed to TimelinePanel's `eventFilter`. No
 * indexing change is involved — media filenames are already indexed; this only filters the *displayed* list.
 */
export function RoomFilesView({ timelineSet, onPaginationRequest, empty }: Props): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new RoomFilesViewModel());
    const { activeCategory, searchTerm } = useViewModel(vm);

    const eventFilter = useMemo(() => buildFileEventFilter(activeCategory, searchTerm), [activeCategory, searchTerm]);

    // Compound's ChatFilter forces tabIndex=0 on every chip, so we can't do a single-tab-stop roving index; instead
    // we keep the listbox keyboard-navigable by moving focus across the chips with the arrow / Home / End keys.
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        const count = FILE_CATEGORY_TABS.length;
        const current = tabRefs.current.findIndex((el) => el === document.activeElement);
        if (current === -1) return;

        let target: number;
        switch (e.key) {
            case "ArrowRight":
            case "ArrowDown":
                target = (current + 1) % count;
                break;
            case "ArrowLeft":
            case "ArrowUp":
                target = (current - 1 + count) % count;
                break;
            case "Home":
                target = 0;
                break;
            case "End":
                target = count - 1;
                break;
            default:
                return;
        }
        e.preventDefault();
        tabRefs.current[target]?.focus();
    };

    return (
        <>
            <div className="mx_RoomFilesView_header">
                <Flex
                    as="div"
                    role="listbox"
                    aria-label={_t("file_panel|tabs_label")}
                    align="center"
                    gap="var(--cpd-space-2x)"
                    className="mx_RoomFilesView_tabs"
                    onKeyDown={onTabsKeyDown}
                >
                    {FILE_CATEGORY_TABS.map((category, index) => (
                        <ChatFilter
                            key={category}
                            ref={(el) => {
                                tabRefs.current[index] = el;
                            }}
                            role="option"
                            selected={category === activeCategory}
                            onClick={() => vm.setCategory(category)}
                        >
                            {_t(TAB_LABELS[category])}
                        </ChatFilter>
                    ))}
                </Flex>
                <Form.Root className="mx_RoomFilesView_search" onSubmit={(e) => e.preventDefault()}>
                    <Search
                        placeholder={_t("file_panel|search_placeholder")}
                        name="file_search"
                        value={searchTerm}
                        onChange={(e) => vm.setSearchTerm(e.currentTarget.value)}
                    />
                </Form.Root>
            </div>
            <EventPresentationContextProvider layout={Layout.Group}>
                <TimelinePanel
                    manageReadReceipts={false}
                    manageReadMarkers={false}
                    timelineSet={timelineSet}
                    showUrlPreview={false}
                    onPaginationRequest={onPaginationRequest}
                    empty={empty}
                    layout={Layout.Group}
                    eventFilter={eventFilter}
                />
            </EventPresentationContextProvider>
        </>
    );
}
