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
import { decode } from "html-entities";

import { isPermalinkHost } from "../../utils/permalinks/Permalinks";
import { mediaFromMxc } from "../../customisations/Media";
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
     * Parse a numeric value from OpenGraph. The OpenGraph spec defines all values as strings
     * although Synapse may return these values as numbers. To be compatible, test strings
     * and numbers.
     * @param value The numeric value
     * @returns A number if the value parsed correctly, or undefined otherwise.
     */
    private static getNumberFromOpenGraph(value: number | string | undefined): number | undefined {
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

    /**
     * Calculate the best possible title from an opengraph response.
     * @param response The opengraph response
     * @param link The link being used to preview.
     * @returns The title value.
     */
    private static getBaseMetadataFromResponse(
        response: IPreviewUrlResponse,
        link: string,
    ): Pick<UrlPreviewViewSnapshotPreview, "title" | "description" | "siteName"> {
        let title =
            typeof response["og:title"] === "string" && response["og:title"].trim()
                ? response["og:title"].trim()
                : undefined;
        let description =
            typeof response["og:description"] === "string" && response["og:description"].trim()
                ? response["og:description"].trim()
                : undefined;
        let siteName =
            typeof response["og:site_name"] === "string" && response["og:site_name"].trim()
                ? response["og:site_name"].trim()
                : undefined;

        if (!title && description) {
            title = description;
            description = undefined;
        } else if (!title && siteName) {
            title = siteName;
            siteName = undefined;
        } else if (!title) {
            title = link;
        }

        return {
            title,
            description: description && decode(description),
            siteName,
        };
    }

    /**
     * Determine if an anchor element can be rendered into a preview.
     * If it can, return the value of `href`
     * @param node The anchor element DOM node.
     * @returns The value of the `href` of the node, or null if this node cannot be previewed.
     */
    private static getAnchorLink(node: HTMLAnchorElement): string | null {
        // don't try to preview relative links
        const href = node.getAttribute("href");
        if (!href || !URL.canParse(href)) {
            return null;
        }

        const url = new URL(href);
        if (!["http:", "https:"].includes(url.protocol)) {
            return null;
        }
        // never preview permalinks (if anything we should give a smart
        // preview of the room/user they point to: nobody needs to be reminded
        // what the matrix.to site looks like).
        if (isPermalinkHost(url.host)) {
            return null;
        }

        // as a random heuristic to avoid highlighting things like "foo.pl"
        // we require the linked text to either include a / (either from http://
        // or from a full foo.bar/baz style schemeless URL) - or be a markdown-style
        // link, in which case we check the target text differs from the link value.
        if (node.textContent?.includes("/")) {
            return href;
        }

        if (node.textContent?.toLowerCase().trim().startsWith(url.host.toLowerCase())) {
            // it's a "foo.pl" style link
            return null;
        }
        // it's a [foo bar](http://foo.com) style link
        return href;
    }

    /**
     * Calculate the set of links from a set of DOM nodes.
     * @param nodes An array of DOM elements that may be or contain anchor elements.
     * @returns A unique array of links that can be previewed, in order of discovery.
     */
    private static findLinks(nodes: Iterable<Element>): string[] {
        let links = new Set<string>();

        for (const node of nodes) {
            if (node.tagName === "A") {
                const href = this.getAnchorLink(node as HTMLAnchorElement);
                if (href) {
                    links.add(href);
                }
            } else if (node.tagName === "PRE" || node.tagName === "CODE" || node.tagName === "BLOCKQUOTE") {
                continue;
            } else if (node.children && node.children.length) {
                links = new Set([...links, ...this.findLinks(node.children)]);
            }
        }
        return [...links];
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
    private readonly previewCache = new Map<string, UrlPreviewViewSnapshotPreview>();

    /**
     * Called when the user clicks on the preview thumbnail.
     */
    public readonly onImageClick: (preview: UrlPreviewViewSnapshotPreview) => void;

    public constructor(props: UrlPreviewViewModelProps) {
        const storageKey = `hide_preview_${props.mxEvent.getId()}`;
        super(props, {
            previews: [],
            totalPreviewCount: 0,
            previewsLimited: true,
            overPreviewLimit: false,
            compactLayout: SettingsStore.getValue("useCompactLayout"),
        });
        this.urlPreviewEnabledByUser = globalThis.localStorage.getItem(storageKey) !== "1";
        this.urlPreviewVisible = props.visible;
        this.mediaVisible = props.mediaVisible;
        this.storageKey = storageKey;
        this.client = props.client;
        this.eventSendTime = props.mxEvent.getTs();
        this.onImageClick = props.onImageClicked;
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
        let preview: IPreviewUrlResponse;

        try {
            preview = await this.client.getUrlPreview(link, this.eventSendTime);
        } catch (error) {
            if (error instanceof MatrixError && error.httpStatus === 404) {
                // Quieten 404 Not found errors, not all URLs can have a preview generated
                logger.debug("Failed to get URL preview: ", error);
            } else {
                logger.error("Failed to get URL preview: ", error);
            }
            return null;
        }

        const { title, description, siteName } = UrlPreviewViewModel.getBaseMetadataFromResponse(preview, link);
        const hasImage = preview["og:image"] && typeof preview?.["og:image"] === "string";
        // Ensure we have something relevant to render.
        // The title must not just be the link, or we must have an image.
        if (title === link && !hasImage) {
            return null;
        }
        let image: UrlPreviewViewSnapshotPreview["image"];
        if (typeof preview["og:image"] === "string" && this.visibility > PreviewVisibility.MediaHidden) {
            const media = mediaFromMxc(preview["og:image"], this.client);
            const declaredHeight = UrlPreviewViewModel.getNumberFromOpenGraph(preview["og:image:height"]);
            const declaredWidth = UrlPreviewViewModel.getNumberFromOpenGraph(preview["og:image:width"]);
            const width = Math.min(declaredWidth ?? PREVIEW_WIDTH, PREVIEW_WIDTH);
            const height = thumbHeight(width, declaredHeight, PREVIEW_WIDTH, PREVIEW_WIDTH) ?? PREVIEW_WIDTH;
            const thumb = media.getThumbnailOfSourceHttp(PREVIEW_WIDTH, PREVIEW_HEIGHT, "scale");
            // No thumb, no preview.
            if (thumb) {
                image = {
                    imageThumb: thumb,
                    imageFull: media.srcHttp ?? thumb,
                    width,
                    height,
                    fileSize: UrlPreviewViewModel.getNumberFromOpenGraph(preview["matrix:image:size"]),
                };
            }
        }

        const result = {
            link,
            title,
            description,
            siteName,
            showTooltipOnLink: link !== title && PlatformPeg.get()?.needsUrlTooltips(),
            image,
        } satisfies UrlPreviewViewSnapshotPreview;
        this.previewCache.set(link, result);
        return result;
    }

    public dispose(): void {
        super.dispose();
        SettingsStore.unwatchSetting(this.useCompactLayoutSettingWatcher);
    }

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

    /**
     * Recompute the snapshot for the view model, generating previews
     * for the previously-calculated links.
     */
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
    }

    /**
     * Trigger a recalculation of the links in an event.
     * @param eventElement
     */
    public async updateEventElement(eventElement: HTMLDivElement): Promise<void> {
        const newLinks = UrlPreviewViewModel.findLinks([eventElement]);
        // Only recalculate if the set of links has changed.
        if (newLinks.some((x) => !this.links.includes(x)) || this.links.some((x) => !newLinks.includes(x))) {
            this.links = newLinks;
            return this.computeSnapshot();
        }
    }

    /**
     * Update the view model about the status of whether the event should be
     * viewable.
     * @param urlPreviewVisible Whether URL previews are hidden for this room.
     * @param mediaVisible Whether media is hidden for this room or event.
     *
     * @returns A promise that completes when the snapshot has been recomputed.
     */
    public readonly updateHidden = (urlPreviewVisible: boolean, mediaVisible: boolean): Promise<void> => {
        this.urlPreviewVisible = urlPreviewVisible;
        this.mediaVisible = mediaVisible;
        // Changing the visibility here means we need to clear cache as we may need to load
        // the media again.
        this.previewCache.clear();
        return this.computeSnapshot();
    };

    /**
     * Called when the user has requsted previews be visible. The provided
     * props `urlPreviewVisible` state will always override this.
     *
     * @returns A promise that completes when the snapshot has been recomputed.
     */
    public readonly onShowClick = (): Promise<void> => {
        // FIXME: persist this somewhere smarter than local storage
        this.urlPreviewEnabledByUser = true;
        globalThis.localStorage?.removeItem(this.storageKey);
        return this.computeSnapshot();
    };

    /**
     * Called when the user has requsted previews be hidden. Will take precedence
     * over other settings.
     *
     * @returns A promise that completes when the snapshot has been recomputed.
     */
    public readonly onHideClick = (): Promise<void> => {
        // FIXME: persist this somewhere smarter than local storage
        globalThis.localStorage?.setItem(this.storageKey, "1");
        this.urlPreviewEnabledByUser = false;
        return this.computeSnapshot();
    };

    /**
     * Called when the user toggles the number of previews visible.
     *
     * @returns A promise that completes when the snapshot has been recomputed.
     */
    public readonly onTogglePreviewLimit = (): Promise<void> => {
        this.limitPreviews = !this.limitPreviews;
        return this.computeSnapshot();
    };

    /**
     * `true` only when the user has chosen to hide previews.
     */
    public get isPreviewHiddenByUser(): boolean {
        return this.visibility === PreviewVisibility.UserHidden;
    }
}
