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
    visible: boolean;
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

export enum PreviewVisibility {
    /**
     * Preview is entirely hidden from view and can not be changed.
     */
    Hidden,
    /**
     * Preview is entirely hidden from view but the user may change this.
     */
    UserHidden,
    /**
     * Preview is visible but media should not be rendered.
     */
    MediaHidden,
    /**
     * Preview is visible and media should be rendered.
     */
    Visible,
}

/**
 * ViewModel for fetching and rendering URL previews for an individual event.
 */
export class UrlPreviewViewModel
    extends BaseViewModel<UrlPreviewGroupViewSnapshot, UrlPreviewViewModelProps>
    implements UrlPreviewGroupViewActions
{
    /**
     * Determine if an anchor element can be rendered into a preview.
     * @param node The anchor element DOM node.
     */
    private static isLinkPreviewable(node: HTMLAnchorElement): boolean {
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

    /**
     * Calculate the set of links from a set of DOM nodes.
     * @param nodes An array of DOM elements that may be or contain anchor elements.
     * @returns A unique array of links that can be previewed, in order of discovery.
     */
    private static findLinks(nodes: ArrayLike<Element>): string[] {
        let links = new Set<string>();

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.tagName === "A" && node.getAttribute("href")) {
                if (this.isLinkPreviewable(node as HTMLAnchorElement)) {
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

    /**
     * Fetch a complete preview of a given URL.
     * Will always return a cached response if it was previously calculated.
     * @param link A URL to be previewed.
     * @returns A Promise that returns the snapshot needed to render the preview, or null
     * if the resource could not be previewed.
     */
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
            if (title === link && !hasImage) {
                return null;
            }

            const media =
                typeof preview["og:image"] === "string" && this.visibility >= PreviewVisibility.MediaHidden
                    ? mediaFromMxc(preview["og:image"], this.client)
                    : undefined;
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
    private readonly storageKey: string;
    private readonly eventSendTime: number;
    private readonly useCompactLayoutSettingWatcher: string;

    /**
     * Should the URL preview render according to the application.
     */
    private urlPreviewVisible: boolean;
    /**
     * Should media be rendered in the preview.
     */
    private mediaVisible: boolean;
    /**
     * Has the user opted to render this individual preview, or hide it.
     */
    private urlPreviewEnabledByUser: boolean;

    /**
     * Calculated set of links from the provided DOM element.
     */
    private links: Array<string> = [];

    /**
     * Should the preview limit how many links are rendered. If `false`, all
     * links will be rendered.
     */
    private limitPreviews = true;

    /**
     * A cache containing all previously calculated previews.
     */
    private previewCache = new Map<string, UrlPreviewViewSnapshotPreview>();

    /**
     * Callback for when the image element is clicked on.
     */
    private readonly onImageClicked: (preview: UrlPreviewViewSnapshotPreview) => void;

    public constructor(props: UrlPreviewViewModelProps) {
        const storageKey = `hide_preview_${props.mxEvent.getId()}`;
        super(props, {
            previews: [],
            totalPreviewCount: 0,
            previewsLimited: true,
            overPreviewLimit: false,
            compactLayout: SettingsStore.getValue("useCompactLayout"),
        });
        this.urlPreviewEnabledByUser = global.localStorage.getItem(storageKey) !== "1";
        this.urlPreviewVisible = props.visible;
        this.mediaVisible = props.mediaVisible;
        this.storageKey = storageKey;
        this.client = props.client;
        this.eventSendTime = props.mxEvent.getTs();
        this.onImageClicked = props.onImageClicked;
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

    /**
     * Get the visibility for the preview based on the the internal
     * and external state.
     */
    private get visibility(): PreviewVisibility {
        if (!this.urlPreviewVisible) {
            return PreviewVisibility.Hidden;
        } else if (!this.urlPreviewEnabledByUser) {
            return PreviewVisibility.UserHidden;
        } else if (!this.mediaVisible) {
            return PreviewVisibility.MediaHidden;
        }
        return PreviewVisibility.Visible;
    }

    private async computeSnapshot(): Promise<void> {
        const previews =
            this.visibility <= PreviewVisibility.UserHidden
                ? []
                : await Promise.all(
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
        console.log("SNAPSHOT", this.visibility, previews, this.snapshot.current);
    }

    /**
     * Trigger a recalculation of the links in an event.
     * @param eventElement
     */
    public updateEventElement(eventElement: HTMLDivElement): Promise<void> {
        this.links = UrlPreviewViewModel.findLinks([eventElement]);
        return this.computeSnapshot();
    }

    /**
     * Update the view model about the status of whether the event should be
     * viewable.
     * @param urlPreviewVisible Whether URL previews are hidden for this room.
     * @param mediaVisible Whether media is hidden for this room or event.
     */
    public updateHidden(urlPreviewVisible: boolean, mediaVisible: boolean): void {
        this.urlPreviewVisible = urlPreviewVisible;
        this.mediaVisible = mediaVisible;
        // Changing the visibility here means we need to clear cache as we may need to load
        // the media again.
        this.previewCache.clear();
        void this.computeSnapshot();
    }

    /**
     * Called when the user has requsted previews be visible. The provided
     * props `urlPreviewVisible` state will always override this.
     */
    public readonly onShowClick = (): void => {
        // FIXME: persist this somewhere smarter than local storage
        this.urlPreviewEnabledByUser = true;
        global.localStorage?.removeItem(this.storageKey);
        void this.computeSnapshot();
    };

    /**
     * Called when the user has requsted previews be hidden. Will take precedence
     * over other settings.
     */
    public readonly onHideClick = (): void => {
        // FIXME: persist this somewhere smarter than local storage
        global.localStorage?.setItem(this.storageKey, "1");
        this.urlPreviewEnabledByUser = false;
        void this.computeSnapshot();
    };

    /**
     * Called when the user toggle the number of previews visible.
     */
    public readonly onTogglePreviewLimit = (): void => {
        this.limitPreviews = !this.limitPreviews;
        void this.computeSnapshot();
    };

    /**
     * Called when the user clicks on the preview thumbnail.
     */
    public readonly onImageClick = (preview: UrlPreviewViewSnapshotPreview): void => {
        // Render a lightbox.
        this.onImageClicked(preview);
    };

    /**
     * `true` only when the user has chosen to hide previews.
     */
    public get isPreviewHiddenByUser(): boolean {
        return this.visibility === PreviewVisibility.UserHidden;
    }
}
