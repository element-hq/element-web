/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { BaseViewModel, type MessageComposerUrlPreviewSnapshot } from "@element-hq/web-shared-components";

import { UrlPreviewFetcher } from "../../utils/UrlPreviewFetcher";
import { debounce } from "lodash";

const logger = rootLogger.getChild("MessageComposerUrlPreviewViewModel");

export interface MessageComposerUrlPreviewViewModelProps {
    client: MatrixClient;
    visible: boolean;
    showTooltips: boolean;
    urlPreviewBundle: boolean;
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

    private content: string = "";

    public constructor(props: MessageComposerUrlPreviewViewModelProps) {
        super(props, { previews: [] });
        this.urlPreviewVisible = props.visible;
        this.fetcher = new UrlPreviewFetcher(props.client, Date.now(), props.showTooltips);
    }

    private async computeSnapshot(): Promise<void> {
        const newLinksOrdered = this.content
            .split(" ")
            .map((w) => w.trim())
            .filter((word) => URL.canParse(word));
        const newLinks = new Set(newLinksOrdered);
        if (this.links.symmetricDifference(newLinks).size === 0) {
            // Skip if the URL set hasn't changed
            return;
        }
        this.links = newLinks;

        if (!this.urlPreviewVisible) {
            this.snapshot.set({ previews: [] });
            return;
        }

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

            this.snapshot.set({ previews });
        } else {
            for (const link of this.links) {
                try {
                    const preview = await this.fetcher.fetchPreview(link, true);
                    if (preview) {
                        this.snapshot.set({ previews: [preview] });
                        return;
                    }
                } catch (ex) {
                    logger.warn("Fetching preview failed", ex);
                }
            }

            this.snapshot.set({ previews: [] });
        }
    }

    /**
     * Trigger a recalculation of the links in the provided text.
     * @param content Plaintext from the message composer.
     */
    public async updateWithText(content: string): Promise<void> {
        this.content = content;

        if (content === "") {
            return this.computeSnapshot();
        } else {
            return this.computeSnapshotDebounced();
        }
    }

    private computeSnapshotDebounced = debounce(this.computeSnapshot, 500);

    /**
     * Update the view model about visible state of previews.
     * @param urlPreviewVisible Whether URL previews are hidden for this room.
     *
     * @returns A promise that completes when the snapshot has been recomputed.
     */
    public readonly updateUrlPreviewVisible = (urlPreviewVisible: boolean): Promise<void> => {
        this.urlPreviewVisible = urlPreviewVisible;
        this.fetcher.clearCache();
        return this.computeSnapshot();
    };
}
