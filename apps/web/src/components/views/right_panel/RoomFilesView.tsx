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
import BaseCard from "./BaseCard";
import Measured from "../elements/Measured";
import SearchWarning, { WarningKind } from "../elements/SearchWarning";
import { EventPresentationContextProvider } from "../../../utils/EventPresentationContextProvider";
import { RoomFilesViewModel } from "../../../viewmodels/right_panel/RoomFilesViewModel";
import { buildFileEventFilter, FILE_CATEGORY_FILTERS, FileCategory } from "../../../utils/FileCategory";

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
    /** Closes the right panel. */
    onClose(this: void): void;
    /** Whether the room is encrypted, so the card can warn that server-side file search is unavailable. */
    isRoomEncrypted: boolean;
    /** Called when the card is measured, so {@link FilePanel} can put the room context into narrow mode. */
    onMeasurement(this: void, narrow: boolean): void;
}

const FILTER_LABELS: Record<FileCategory, TranslationKey> = {
    [FileCategory.Documents]: "file_panel|filter_documents",
    [FileCategory.Images]: "file_panel|filter_images",
    [FileCategory.Videos]: "file_panel|filter_videos",
    [FileCategory.Audio]: "file_panel|filter_audio",
};

/**
 * The shared-media card: a filename/caption search in the card header, a row of media category filter chips
 * (Documents / Images / Videos / Audio), and a {@link TimelinePanel} over the room's shared-media timeline
 * (search Phase 4).
 *
 * The chips are a *toggle*, not a tab strip: with no chip selected every media type shows, which is why there is
 * no "All" chip. This mirrors the room list's primary filters (`RoomListPrimaryFilters`).
 *
 * MVVM v2: the category selection + search term live in {@link RoomFilesViewModel}; the timeline display predicate
 * is derived from the snapshot via the pure {@link buildFileEventFilter} and handed to TimelinePanel's
 * `eventFilter`. No indexing change is involved — media filenames are already indexed; this only filters the
 * *displayed* list.
 */
export function RoomFilesView({
    timelineSet,
    onPaginationRequest,
    empty,
    onClose,
    isRoomEncrypted,
    onMeasurement,
}: Props): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new RoomFilesViewModel());
    const { activeCategory, searchTerm } = useViewModel(vm);
    const card = useRef<HTMLDivElement>(null);

    const eventFilter = useMemo(() => buildFileEventFilter(activeCategory, searchTerm), [activeCategory, searchTerm]);

    // Compound's ChatFilter forces tabIndex=0 on every chip, so we can't do a single-tab-stop roving index; instead
    // we keep the listbox keyboard-navigable by moving focus across the chips with the arrow / Home / End keys.
    const filterRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const onFiltersKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        const count = FILE_CATEGORY_FILTERS.length;
        const current = filterRefs.current.findIndex((el) => el === document.activeElement);
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
        filterRefs.current[target]?.focus();
    };

    // The search sits in the card header, in place of the card title and alongside the close button.
    const header = (
        <Form.Root className="mx_RoomFilesView_search" onSubmit={(e) => e.preventDefault()}>
            <Search
                placeholder={_t("file_panel|search_placeholder")}
                name="file_search"
                value={searchTerm}
                onChange={(e) => vm.setSearchTerm(e.currentTarget.value)}
                className="mx_no_textinput"
            />
        </Form.Root>
    );

    return (
        <BaseCard className="mx_FilePanel" onClose={onClose} withoutScrollContainer ref={card} header={header}>
            <Measured sensor={card} onMeasurement={onMeasurement} />
            <SearchWarning isRoomEncrypted={isRoomEncrypted} kind={WarningKind.Files} />
            <Flex
                as="div"
                role="listbox"
                aria-label={_t("file_panel|filters_label")}
                align="center"
                gap="var(--cpd-space-2x)"
                className="mx_RoomFilesView_filters"
                onKeyDown={onFiltersKeyDown}
            >
                {FILE_CATEGORY_FILTERS.map((category, index) => (
                    <ChatFilter
                        key={category}
                        ref={(el) => {
                            filterRefs.current[index] = el;
                        }}
                        role="option"
                        selected={category === activeCategory}
                        onClick={() => vm.toggleCategory(category)}
                    >
                        {_t(FILTER_LABELS[category])}
                    </ChatFilter>
                ))}
            </Flex>
            {/*
             * The shared-media list is always rendered in bubble layout, independently of the user's timeline
             * layout setting — the main timeline keeps whatever the user picked (modern by default).
             */}
            <EventPresentationContextProvider layout={Layout.Bubble}>
                <TimelinePanel
                    manageReadReceipts={false}
                    manageReadMarkers={false}
                    timelineSet={timelineSet}
                    showUrlPreview={false}
                    onPaginationRequest={onPaginationRequest}
                    empty={empty}
                    layout={Layout.Bubble}
                    eventFilter={eventFilter}
                />
            </EventPresentationContextProvider>
        </BaseCard>
    );
}
