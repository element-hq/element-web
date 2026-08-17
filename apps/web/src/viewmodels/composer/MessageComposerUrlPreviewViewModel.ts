/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type MessageComposerUrlPreviewSnapshotEntry,
    type MessageComposerUrlPreviewSnapshot,
} from "@element-hq/web-shared-components";
import { debounce } from "lodash";

import { UrlPreviewFetcher } from "../../utils/UrlPreviewFetcher";

export const DEBOUNCE_REQUEST_TIMEOUT_MS = 500;

export interface MessageComposerUrlPreviewViewModelProps {
    client: MatrixClient;
    visible: boolean;
    showTooltips: boolean;
    urlPreviewBundle: boolean;
    content?: string;
}

export class MessageComposerUrlPreviewViewModel extends BaseViewModel<
    MessageComposerUrlPreviewSnapshot,
    MessageComposerUrlPreviewViewModelProps
> {
    private readonly fetcher: UrlPreviewFetcher;

    /**
     * Calculated set of links from the message text.
     *
     * Links are inserted in the order they appear in the message text,
     * which guarantees Array.from(this.links) to be in the same order.
     */
    private links: Set<string> = new Set();

    /**
     * Should the URL preview render according to the application.
     */
    private urlPreviewVisible: boolean;

    /**
     * Composer content when updateWithText is most recently called
     */
    private content: string;

    /**
     * The list of all previews that are currently loading, loaded or failed to load
     * - loading entries are immediately added when computeSnapshot detects new link in the composer
     * - loaded/failed to load entries replaces the loading entry when it resolves
     * - not all previews in cache are displayed: the preview only selects the previews which link is in the composer,
     *   and preview.include is true where the preview has not been removed
     * - the cache is cleared when the composer is emptied: intentionally by user or by sending a message,
     *   this reloads all previews and forgets all preview.include states, causing all previously removed previews to be unremoved
     */
    private readonly previewCache: Map<string, MessageComposerUrlPreviewSnapshotEntry> = new Map();

    public constructor(props: MessageComposerUrlPreviewViewModelProps) {
        super(props, { entries: [], content: props.content ?? "" });
        this.urlPreviewVisible = props.visible;
        this.fetcher = new UrlPreviewFetcher(props.client, Date.now(), props.showTooltips);
        this.content = this.snapshot.current.content;
    }

    public static linksIn(content: string): Set<string> {
        return new Set(
            content
                .split(" ")
                .map((w) => w.trim())
                .filter((word) => URL.canParse(word)),
        );
    }

    private computeSnapshot(content: string): void {
        if (!this.urlPreviewVisible) {
            this.snapshot.set({ entries: [], content });
            return;
        }

        const newLinks = MessageComposerUrlPreviewViewModel.linksIn(content);
        if (this.links.symmetricDifference(newLinks).size === 0) {
            // Skip if the URL set hasn't changed
            return;
        }

        this.links = newLinks;

        const entries = Array.from(this.links).map((link) => {
            // if not in cache, add to VM now, fetch later
            if (!this.previewCache.has(link)) {
                this.previewCache.set(link, {
                    status: "loading",
                    include: true,
                    matched_url: link,
                });

                this.fetcher.fetchPreview(link, true).then((fetched) => {
                    // update cache
                    const currentEntry = this.previewCache.get(link);
                    if (fetched === null) {
                        this.previewCache.set(link, {
                            status: "failed",
                            include: currentEntry?.include ?? true,
                            matched_url: link,
                        });
                    } else {
                        this.previewCache.set(link, {
                            status: "loaded",
                            include: currentEntry?.include ?? true,
                            matched_url: link,
                            preview: fetched,
                        });
                    }

                    // insert to snapshot
                    const updatedEntry = this.previewCache.get(link);
                    if (updatedEntry === undefined) return;

                    const snapshot = this.snapshot.current;

                    this.snapshot.set({
                        content: snapshot.content,
                        entries: snapshot.entries.map((entry) =>
                            entry.matched_url === updatedEntry.matched_url ? updatedEntry : entry,
                        ),
                    });
                });
            }

            return this.previewCache.get(link)!;
        });

        this.snapshot.set({ entries, content });
    }

    /**
     * Trigger a recalculation of the links in the provided text.
     * @param content Plaintext from the message composer.
     */
    public updateWithText({ content, debounced }: { content?: string; debounced: boolean }): void {
        if (content !== undefined) {
            this.content = content;
        }

        if (content === "") {
            this.previewCache.clear();
            this.computeSnapshotDebounced.cancel();
            return this.computeSnapshot("");
        }

        if (debounced) {
            return this.computeSnapshotDebounced(this.content);
        } else {
            this.computeSnapshotDebounced.cancel();
            return this.computeSnapshot(this.content);
        }
    }

    private computeSnapshotDebounced = debounce(
        (content) => this.computeSnapshot(content),
        DEBOUNCE_REQUEST_TIMEOUT_MS,
    );

    /**
     * Update the view model about visible state of previews.
     * @param urlPreviewVisible Whether URL previews are hidden for this room.
     *
     * @returns A promise that completes when the snapshot has been recomputed.
     */
    public readonly updateUrlPreviewVisible = (urlPreviewVisible: boolean): void => {
        this.urlPreviewVisible = urlPreviewVisible;
        this.fetcher.clearCache();
        return this.computeSnapshot(this.content);
    };

    /**
     * Remove a preview of a URL and remembers it until cache is cleared
     * @param url A URL that has been previously requested since the last time composer is empty
     */
    public readonly removePreview = (url: string): void => {
        const entry = this.previewCache.get(url);
        if (entry === undefined) return;
        entry.include = false;

        const snapshot = this.snapshot.current;

        this.snapshot.set({
            content: snapshot.content,
            entries: snapshot.entries.filter((entry) => entry.include),
        });
    };
}
