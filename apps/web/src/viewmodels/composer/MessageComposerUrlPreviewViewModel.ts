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
    private links: Set<string> = new Set();
    private urlPreviewVisible: boolean;

    public constructor(props: MessageComposerUrlPreviewViewModelProps) {
        super(props, { preview: null });
        this.urlPreviewVisible = props.visible;
        this.fetcher = new UrlPreviewFetcher(props.client, Date.now(), props.showTooltips);
    }

    private async computeSnapshot(): Promise<void> {
        if (!this.urlPreviewVisible) {
            this.snapshot.merge({ preview: null });
            return;
        }
        for (const link of this.links) {
            try {
                const preview = await this.fetcher.fetchPreview(link, true);
                if (preview) {
                    this.snapshot.merge({ preview });
                    return;
                }
            } catch (ex) {
                logger.warn("Fetching preview failed", ex);
            }
        }
        this.snapshot.merge({ preview: null });
    }

    public async updateWithText(content: string): Promise<void> {
        const newLinks = new Set(content.split(" ").filter((word) => URL.canParse(word.trim())));
        if (this.links.symmetricDifference(newLinks).size === 0) {
            // Skip if the URL set hasn't changed
            return;
        }
        this.links = newLinks;
        return this.computeSnapshot();
    }

    public readonly updateUrlPreviewVisible = (urlPreviewVisible: boolean): Promise<void> => {
        this.urlPreviewVisible = urlPreviewVisible;
        this.fetcher.clearCache();
        return this.computeSnapshot();
    };
}
