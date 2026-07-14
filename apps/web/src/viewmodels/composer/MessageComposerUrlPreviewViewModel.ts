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

const logger = rootLogger.getChild("MessageComposerUrlPreviewViewModel");

export interface MessageComposerUrlPreviewViewModelProps {
    client: MatrixClient;
    visible: boolean;
    showTooltips: boolean;
}

export class MessageComposerUrlPreviewViewModel extends BaseViewModel<
    MessageComposerUrlPreviewSnapshot,
    MessageComposerUrlPreviewViewModelProps
> {
    private readonly fetcher: UrlPreviewFetcher;

    /**
     * Calculated set of links from the message text.
     */
    private links: Set<string> = new Set();

    /**
     * Should the URL preview render according to the application.
     */
    private urlPreviewVisible: boolean;

    public constructor(props: MessageComposerUrlPreviewViewModelProps) {
        super(props, { preview: null });
        this.urlPreviewVisible = props.visible;
        this.fetcher = new UrlPreviewFetcher(props.client, Date.now(), props.showTooltips);
    }

    private async computeSnapshot(): Promise<void> {
        if (!this.urlPreviewVisible) {
            this.snapshot.set({ preview: null });
            return;
        }
        // We always select the *first* viable preview out of the message.
        // Subsequent links are ignored.
        for (const link of this.links) {
            try {
                const preview = await this.fetcher.fetchPreview(link, true);
                if (preview) {
                    this.snapshot.set({ preview });
                    return;
                }
            } catch (ex) {
                logger.warn("Fetching preview failed", ex);
            }
        }
        this.snapshot.set({ preview: null });
    }

    /**
     * Trigger a recalculation of the links in the provided text.
     * @param content Plaintext from the message composer.
     */
    public async updateWithText(content: string): Promise<void> {
        const newLinks = new Set(
            content
                .split(" ")
                .map((w) => w.trim())
                .filter((word) => URL.canParse(word)),
        );
        if (this.links.symmetricDifference(newLinks).size === 0) {
            // Skip if the URL set hasn't changed
            return;
        }
        this.links = newLinks;
        return this.computeSnapshot();
    }

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
