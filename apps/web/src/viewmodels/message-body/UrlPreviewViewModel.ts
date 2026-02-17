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
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { type IPreviewUrlResponse, type MatrixClient, MatrixError, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { isPermalinkHost } from "../../utils/permalinks/Permalinks";
import { mediaFromMxc } from "../../customisations/Media";
import { linkifyAndSanitizeHtml } from "../../Linkify";
import PlatformPeg from "../../PlatformPeg";
import { thumbHeight } from "../../ImageUtils";
import SettingsStore from "../../settings/SettingsStore";

const logger = rootLogger.getChild("UrlPreviewViewModel");

export interface UrlPreviewViewModelProps {
    client: MatrixClient;
    mxEvent: MatrixEvent;
    mediaVisible: boolean;
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
    if (typeof response["og:site_name"] === "string" && response["og:site_name"]) {
        return response["og:site_name"].trim();
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

    private async fetchPreview(link: string): Promise<UrlPreviewViewSnapshotPreview | null> {
        const cached = this.previewCache.get(link);
        if (cached) {
            return cached;
        }
        try {
            const preview = await this.client.getUrlPreview(link, this.eventSendTime);
            const title = getTitleFromOpenGraph(preview, link);
            const hasImage = preview["og:image"] && typeof preview?.["og:image"] === "string";
            // Ensure we have something relevant to render.
            // The title must not just be the link, or we must have an image.
            if (title === link || !hasImage) {
                return null;
            }

            const media =
                typeof preview["og:image"] === "string" ? mediaFromMxc(preview["og:image"], this.client) : undefined;
            const needsTooltip = link !== title && PlatformPeg.get()?.needsUrlTooltips();

            // TODO: Magic numbers
            const imageMaxHeight = 100;
            const declaredHeight = getNumberFromOpenGraph(preview["og:image:height"]);
            const width = Math.min(getNumberFromOpenGraph(preview["og:image:width"]) || 101, 100);
            // TODO: This is wrong.
            const height = thumbHeight(width, declaredHeight, imageMaxHeight, imageMaxHeight) ?? imageMaxHeight;

            const result = {
                link,
                title,
                siteName: typeof preview["og:site_name"] === "string" ? preview["og:site_name"] : undefined,
                showTooltipOnLink: needsTooltip,
                // Don't show a description if it's the same as the title.
                description:
                    typeof preview["og:description"] === "string" && title !== preview["og:description"]
                        ? linkifyAndSanitizeHtml(preview["og:description"])
                        : undefined,
                image: media
                    ? {
                          // TODO: Check nulls
                          imageThumb: media.getThumbnailOfSourceHttp(PREVIEW_WIDTH, PREVIEW_HEIGHT, "scale")!,
                          imageFull: media.srcHttp!,
                          width,
                          height,
                          fileSize: getNumberFromOpenGraph(preview["matrix:image:size"]),
                      }
                    : undefined,
            } satisfies UrlPreviewViewSnapshotPreview;
            this.previewCache.set(link, result);
            return {
                ...result,
                // We still want to cache the media in case it's enabled, but exclude from the snapshot.
                image: this.mediaVisible ? result.image : undefined,
            };
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

    private eventSendTime: number;
    private limitPreviews = true;
    private mediaVisible: boolean;
    private readonly client: MatrixClient;
    private readonly storageKey: string;
    private readonly useCompactLayoutSettingWatcher: string;
    private links: Array<string> = [];

    private previewCache = new Map<string, UrlPreviewViewSnapshotPreview>();
    private readonly onImageClicked: (preview: UrlPreviewViewSnapshotPreview) => void;

    public constructor(props: UrlPreviewViewModelProps) {
        const storageKey = `hide_preview_${props.mxEvent.getId()}`;
        const showUrlPreview = window.localStorage.getItem(storageKey) !== "1";
        super(props, {
            previews: [],
            hidden: !showUrlPreview,
            totalPreviewCount: 0,
            previewsLimited: true,
            overPreviewLimit: false,
            compactLayout: SettingsStore.getValue("useCompactLayout"),
        });
        this.storageKey = storageKey;
        this.client = props.client;
        this.eventSendTime = props.mxEvent.getTs();
        this.onImageClicked = props.onImageClicked;
        this.mediaVisible = props.mediaVisible;
        this.useCompactLayoutSettingWatcher = SettingsStore.watchSetting(
            "useCompactLayout",
            null,
            (_setting, _roomid, _level, compactLayout) => {
                this.snapshot.merge({
                    compactLayout,
                });
            },
        );
    }

    public dispose(): void {
        super.dispose();
        SettingsStore.unwatchSetting(this.useCompactLayoutSettingWatcher);
    }

    private async computeSnapshot(): Promise<void> {
        const previews = await Promise.all(
            this.links
                .slice(0, this.limitPreviews ? MAX_PREVIEWS_WHEN_LIMITED : undefined)
                .map((link) => this.fetchPreview(link)),
        );
        this.snapshot.merge({
            previews: previews.filter((m) => !!m),
            totalPreviewCount: this.links.length,
            previewsLimited: this.limitPreviews,
            overPreviewLimit: this.links.length > MAX_PREVIEWS_WHEN_LIMITED,
        });
    }

    public updateEventElement(eventElement: HTMLDivElement): void {
        this.links = UrlPreviewViewModel.findLinks([eventElement]);
        if (!this.snapshot.current.hidden) {
            void this.computeSnapshot();
        }
    }

    public readonly onShowClick = (): void => {
        this.snapshot.merge({
            hidden: false,
        });
        // FIXME: persist this somewhere smarter than local storage
        global.localStorage?.removeItem(this.storageKey);
    };

    public readonly onHideClick = (): void => {
        this.snapshot.merge({
            hidden: true,
        });
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
