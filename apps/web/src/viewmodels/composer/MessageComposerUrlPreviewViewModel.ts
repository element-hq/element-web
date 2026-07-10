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

    private previewCache: Map<string, MessageComposerUrlPreviewSnapshotEntry> = new Map();

    public constructor(props: MessageComposerUrlPreviewViewModelProps) {
        super(props, { entries: [], content: props.content ?? "" });
        this.urlPreviewVisible = props.visible;
        this.fetcher = new UrlPreviewFetcher(props.client, Date.now(), props.showTooltips);
        this.content = this.snapshot.current.content;
    }

    private computeSnapshot(content: string): void {
        const newLinksOrdered = content
            .split(" ")
            .map((w) => w.trim())
            .filter((word) => URL.canParse(word));
        const newLinks = new Set(newLinksOrdered);

        if (!this.urlPreviewVisible) {
            // Clear any existing previews whenever previews are hidden, regardless of
            // whether the URL set has changed (e.g. when toggled invisible).
            this.snapshot.set({ previews: [], content });
            return;
        }

        if (!this.urlPreviewVisible) {
            this.snapshot.set({ entries: [], content });
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

                const insertToSnapshot = (): void => {
                    const updatedEntry = this.previewCache.get(link);
                    if (updatedEntry === undefined) return;

                    const snapshot = this.snapshot.current;

                    this.snapshot.set({
                        content: snapshot.content,
                        entries: snapshot.entries.map((entry) =>
                            entry.matched_url === updatedEntry.matched_url ? updatedEntry : entry,
                        ),
                    });
                };

                this.fetcher.fetchPreview(link, true).then((fetched) => {
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

                    insertToSnapshot();
                });
            }

            return this.previewCache.get(link) as MessageComposerUrlPreviewSnapshotEntry;
        });

        this.snapshot.set({ entries, content });
    }

    /**
     * Trigger a recalculation of the links in the provided text.
     * @param content Plaintext from the message composer.
     */
    public async updateWithText({ content, debounced }: { content?: string; debounced: boolean }): Promise<void> {
        if (content !== undefined) {
            this.content = content;
        }

        if (debounced) {
            return this.computeSnapshotDebounced(this.content);
        } else {
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
}
