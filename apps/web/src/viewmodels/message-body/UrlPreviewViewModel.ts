/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type UrlPreviewGroupViewSnapshot,
    type UrlPreviewGroupViewActions,
    type UrlPreviewViewSnapshotPreview,
} from "@element-hq/web-shared-components";
// import { decode } from "html-entities";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { type IPreviewUrlResponse, type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";

import type { RefObject } from "react";
import { isPermalinkHost } from "../../utils/permalinks/Permalinks";
import { mediaFromMxc } from "../../customisations/Media";
import { linkifyAndSanitizeHtml } from "../../Linkify";
import PlatformPeg from "../../PlatformPeg";
import { thumbHeight } from "../../ImageUtils";

const logger = rootLogger.getChild("UrlPreviewViewModel");

export interface UrlPreviewViewModelProps {
    client: MatrixClient;
    eventSendTime: number;
    eventRef: RefObject<HTMLDivElement | null>;
    eventId?: string;
    onImageClicked: (preview: UrlPreviewViewSnapshotPreview) => void;
}

export const MAX_PREVIEWS_WHEN_LIMITED = 2;
export const PREVIEW_WIDTH = 100;
export const PREVIEW_HEIGHT = 100;

function getNumberFromOpenGraph(value: number | string | undefined): number | undefined {
    if (typeof value === "number") {
        return value;
    } else if (typeof value === "string" && value) {
        const i = parseInt(value, 10);
        if (!isNaN(i)) {
            return i;
        }
    }
    return undefined;
}

function getTitleFromOpenGraph(response: IPreviewUrlResponse, link: string): string {
    if (typeof response["og:title"] === "string" && response["og:title"]) {
        return response["og:title"].trim();
    }
    if (typeof response["og:description"] === "string" && response["og:description"]) {
        return response["og:description"].trim();
    }
    return link;
}

/**
 * ViewModel for fetching and rendering room previews.
 */
export class UrlPreviewViewModel
    extends BaseViewModel<UrlPreviewGroupViewSnapshot, UrlPreviewViewModelProps>
    implements UrlPreviewGroupViewActions
{
    private static isLinkPreviewable(node: Element): boolean {
        // don't try to preview relative links
        const href = node.getAttribute("href");
        if (!href || !URL.canParse(href)) {
            return false;
        }

        const url = new URL(href);
        if (!["http:", "https:"].includes(url.protocol)) {
            return false;
        }
        // never preview permalinks (if anything we should give a smart
        // preview of the room/user they point to: nobody needs to be reminded
        // what the matrix.to site looks like).
        if (isPermalinkHost(url.host)) {
            return false;
        }

        // as a random heuristic to avoid highlighting things like "foo.pl"
        // we require the linked text to either include a / (either from http://
        // or from a full foo.bar/baz style schemeless URL) - or be a markdown-style
        // link, in which case we check the target text differs from the link value.
        // TODO: make this configurable?
        if (node.textContent?.includes("/")) {
            return true;
        }

        if (node.textContent?.toLowerCase().trim().startsWith(url.host.toLowerCase())) {
            // it's a "foo.pl" style link
            return false;
        } else {
            // it's a [foo bar](http://foo.com) style link
            return true;
        }
    }

    private static findLinks(nodes: ArrayLike<Element>): string[] {
        let links = new Set<string>();

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.tagName === "A" && node.getAttribute("href")) {
                if (this.isLinkPreviewable(node)) {
                    links.add(node.getAttribute("href")!);
                }
            } else if (node.tagName === "PRE" || node.tagName === "CODE" || node.tagName === "BLOCKQUOTE") {
                continue;
            } else if (node.children && node.children.length) {
                links = new Set([...this.findLinks(node.children), ...links]);
            }
        }
        return [...links];
    }

    private async fetchPreview(link: string, ts: number): Promise<UrlPreviewViewSnapshotPreview | null> {
        const cached = this.previewCache.get(link);
        if (cached) {
            return cached;
        }
        try {
            const preview = await this.client.getUrlPreview(link, ts);
            const hasTitle = preview["og:title"] && typeof preview?.["og:title"] === "string";
            const hasDescription = preview["og:description"] && typeof preview?.["og:description"] === "string";
            const hasImage = preview["og:image"] && typeof preview?.["og:image"] === "string";
            // Ensure at least one of the rendered fields is truthy
            if (!hasTitle || !hasDescription || !hasImage) {
                return null;
            }

            const media =
                typeof preview["og:image"] === "string" ? mediaFromMxc(preview["og:image"], this.client) : undefined;
            const title = getTitleFromOpenGraph(preview, link);
            const needsTooltip = link !== title && PlatformPeg.get()?.needsUrlTooltips();

            // TODO: Magic numbers
            const imageMaxHeight = 100;
            const declaredHeight = getNumberFromOpenGraph(preview["og:image:height"]);
            const width = Math.min(getNumberFromOpenGraph(preview["og:image:width"]) || 101, 100);
            const height = thumbHeight(width, declaredHeight, imageMaxHeight, imageMaxHeight) ?? imageMaxHeight;

            const result = {
                link,
                title,
                showTooltipOnLink: needsTooltip,
                description:
                    typeof preview["og:description"] === "string"
                        ? linkifyAndSanitizeHtml(preview["og:description"])
                        : undefined,
                image: media
                    ? {
                          // TODO: Check nulls
                          imageThumb: media.getThumbnailHttp(PREVIEW_WIDTH, PREVIEW_HEIGHT, "scale")!,
                          imageFull: media.srcHttp!,
                          width,
                          height,
                          fileSize: getNumberFromOpenGraph(preview["matrix:image:size"]),
                      }
                    : undefined,
            } satisfies UrlPreviewViewSnapshotPreview;
            this.previewCache.set(link, result);
            return result;
        } catch (error) {
            if (error instanceof MatrixError && error.httpStatus === 404) {
                // Quieten 404 Not found errors, not all URLs can have a preview generated
                logger.debug("Failed to get URL preview: ", error);
            } else {
                logger.error("Failed to get URL preview: ", error);
            }
        }
        return null;
    }

    private readonly client: MatrixClient;
    private readonly eventRef: RefObject<HTMLDivElement | null>;
    private eventSendTime: number;
    private showUrlPreview: boolean;
    private readonly storageKey: string;
    private limitPreviews = true;
    private previewCache = new Map<string, UrlPreviewViewSnapshotPreview>();
    private readonly onImageClicked: (preview: UrlPreviewViewSnapshotPreview) => void;

    public constructor(props: UrlPreviewViewModelProps) {
        super(props, {
            previews: [],
            hidden: false,
            totalPreviewCount: 0,
            previewsLimited: true,
            overPreviewLimit: false,
        });
        this.client = props.client;
        this.eventRef = props.eventRef;
        this.eventSendTime = props.eventSendTime;
        this.storageKey = props.eventId ?? `hide_preview_${props.eventId}`;
        this.showUrlPreview = window.localStorage.getItem(this.storageKey) !== "1";
        this.onImageClicked = props.onImageClicked;
        void this.computeSnapshot();
    }

    private async computeSnapshot(): Promise<void> {
        if (!this.showUrlPreview) {
            this.snapshot.set({
                previews: [],
                hidden: true,
                totalPreviewCount: 0,
                previewsLimited: this.limitPreviews,
                overPreviewLimit: false,
            });
            return;
        }
        if (!this.eventRef.current) {
            // Event hasn't rendered...yet
            this.snapshot.set({
                previews: [],
                hidden: false,
                totalPreviewCount: 0,
                previewsLimited: this.limitPreviews,
                overPreviewLimit: false,
            });
            return;
        }

        const links = UrlPreviewViewModel.findLinks([this.eventRef.current]);
        const previews = await Promise.all(
            links
                .slice(0, this.limitPreviews ? MAX_PREVIEWS_WHEN_LIMITED : undefined)
                .map((link) => this.fetchPreview(link, this.eventSendTime)),
        );
        this.snapshot.set({
            previews: previews.filter((m) => !!m),
            totalPreviewCount: links.length,
            hidden: false,
            previewsLimited: this.limitPreviews,
            overPreviewLimit: links.length > MAX_PREVIEWS_WHEN_LIMITED,
        });
    }

    public recomputeSnapshot(): void {
        void this.computeSnapshot();
    }

    public readonly onShowClick = (): void => {
        this.showUrlPreview = true;
        void this.computeSnapshot();
        // FIXME: persist this somewhere smarter than local storage
        global.localStorage?.removeItem(this.storageKey);
    };

    public readonly onHideClick = (): void => {
        this.showUrlPreview = false;
        void this.computeSnapshot();
        // FIXME: persist this somewhere smarter than local storage
        global.localStorage?.setItem(this.storageKey, "1");
    };

    public readonly onTogglePreviewLimit = (): void => {
        this.limitPreviews = !this.limitPreviews;
        void this.computeSnapshot();
    };

    public readonly onImageClick = (preview: UrlPreviewViewSnapshotPreview): void => {
        // Render a lightbox.
        this.onImageClicked(preview);
    };
}
