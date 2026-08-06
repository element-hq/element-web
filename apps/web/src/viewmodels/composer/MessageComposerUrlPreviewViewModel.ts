/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { BaseViewModel, type MessageComposerUrlPreviewSnapshot } from "@element-hq/web-shared-components";
import { debounce } from "lodash";

import { UrlPreviewFetcher } from "../../utils/UrlPreviewFetcher";

const logger = rootLogger.getChild("MessageComposerUrlPreviewViewModel");

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

    private content: string;

    public constructor(props: MessageComposerUrlPreviewViewModelProps) {
        super(props, { previews: [], content: props.content ?? "" });
        this.urlPreviewVisible = props.visible;
        this.fetcher = new UrlPreviewFetcher(props.client, Date.now(), props.showTooltips);
        this.content = this.snapshot.current.content;
    }

    private async computeSnapshot(content: string): Promise<void> {
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

        if (this.links.symmetricDifference(newLinks).size === 0) {
            // Skip if the URL set hasn't changed
            return;
        }

        this.links = newLinks;

        let previews;
        if (this.props.urlPreviewBundle) {
            const previewRequests = Array.from(this.links).map(async (link) => {
                try {
                    return await this.fetcher.fetchPreview(link, true);
                } catch (ex) {
                    logger.warn("Fetching preview failed", ex);
                    return null;
                }
            });

            // Fetch previews for all links in the message text,
            // And remove the ones with erroneous responses
            const previewResponses = await Promise.all(previewRequests);
            previews = previewResponses.filter((res) => res !== null);

            this.snapshot.set({ previews, content });
        } else {
            for (const link of this.links) {
                try {
                    const preview = await this.fetcher.fetchPreview(link, true);
                    if (preview) {
                        this.snapshot.set({ previews: [preview], content });
                        return;
                    }
                } catch (ex) {
                    logger.warn("Fetching preview failed", ex);
                }
            }

            this.snapshot.set({ previews: [], content });
        }
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
    public readonly updateUrlPreviewVisible = (urlPreviewVisible: boolean): Promise<void> => {
        this.urlPreviewVisible = urlPreviewVisible;
        this.fetcher.clearCache();
        return this.computeSnapshot(this.content);
    };
}
