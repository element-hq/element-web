/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type UrlPreview,
    type UrlPreviewGroupViewActions,
    type UrlPreviewGroupViewSnapshot,
} from "@element-hq/web-shared-components";
import { type UrlPreviewVisibilityChanged } from "@matrix-org/analytics-events/types/typescript/UrlPreviewVisibilityChanged";

import { PosthogAnalytics } from "../../PosthogAnalytics";
import { isPermalinkHost } from "../../utils/permalinks/Permalinks";
import { UrlPreviewFetcher } from "../../utils/UrlPreviewFetcher";

// From https://github.com/matrix-org/matrix-spec-proposals/pull/4095
export const BUNDLED_LINK_PREVIEWS = "com.beeper.linkpreviews";

export const MAX_PREVIEWS_WHEN_LIMITED = 2;

export enum PreviewVisibility {
    /** Preview is entirely hidden and cannot be changed. */
    Hidden,
    /** Preview is hidden by the user and may be shown again. */
    UserHidden,
    /** Preview is visible but media should not be rendered. */
    MediaHidden,
    /** Preview is fully visible including media. */
    Visible,
}

export interface UrlPreviewGroupViewModelProps {
    client: MatrixClient;
    mxEvent: MatrixEvent;
    visible: boolean;
    mediaVisible: boolean;
    showTooltips: boolean;
    onImageClicked: (preview: UrlPreview) => void;
}

export class UrlPreviewGroupViewModel
    extends BaseViewModel<UrlPreviewGroupViewSnapshot, UrlPreviewGroupViewModelProps>
    implements UrlPreviewGroupViewActions
{
    /**
     * Determine if an anchor element can be rendered into a preview.
     * If it can, return the value of `href`
     * @param node The anchor element DOM node.
     * @returns The value of the `href` of the node, or null if this node cannot be previewed.
     */
    private static getAnchorLink(node: HTMLAnchorElement): string | null {
        const href = node.getAttribute("href");
        if (!href || !URL.canParse(href)) return null;

        const url = new URL(href);
        if (!["http:", "https:"].includes(url.protocol)) return null;
        if (isPermalinkHost(url.host)) return null;

        if (node.textContent?.includes("/")) return href;
        if (node.textContent?.toLowerCase().trim().startsWith(url.host.toLowerCase())) return null;
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
                if (href) links.add(href);
            } else if (node.tagName === "PRE" || node.tagName === "CODE" || node.tagName === "BLOCKQUOTE") {
                continue;
            } else if (node.children?.length) {
                links = new Set([...links, ...this.findLinks(node.children)]);
            }
        }
        return [...links];
    }

    private readonly storageKey: string;
    private readonly fetcher: UrlPreviewFetcher;

    /**
     * Calculated set of links from the provided DOM element.
     */
    private links: string[] = [];

    /**
     * Should the preview limit how many links are rendered. If `false`, all
     * links will be rendered.
     */
    private limitPreviews = true;

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
     * Called when the user clicks on the preview thumbnail.
     */
    public readonly onImageClick: (preview: UrlPreview) => void;

    public constructor(props: UrlPreviewGroupViewModelProps) {
        super(props, {
            previews: [],
            totalPreviewCount: 0,
            previewsLimited: true,
            overPreviewLimit: false,
        });
        this.onImageClick = props.onImageClicked;
        this.storageKey = `hide_preview_${props.mxEvent.getId()}`;
        this.urlPreviewVisible = props.visible;
        this.mediaVisible = props.mediaVisible;
        this.urlPreviewEnabledByUser = globalThis.localStorage.getItem(this.storageKey) !== "1";
        this.fetcher = new UrlPreviewFetcher(props.client, props.mxEvent.getTs(), props.showTooltips);
    }

    /**
     * `true` only when the user has chosen to hide previews.
     */
    public get isPreviewHiddenByUser(): boolean {
        return this.visibility === PreviewVisibility.UserHidden;
    }

    private get visibility(): PreviewVisibility {
        if (!this.urlPreviewVisible) return PreviewVisibility.Hidden;
        if (!this.urlPreviewEnabledByUser) return PreviewVisibility.UserHidden;
        if (!this.mediaVisible) return PreviewVisibility.MediaHidden;
        return PreviewVisibility.Visible;
    }

    /**
     * Recompute the snapshot for the view model, generating previews
     * for the previously-calculated links.
     */
    private async computeSnapshot(): Promise<void> {
        // MSC4095: an empty bundled previews array means the sender opted out of previews.
        const bundledLinkPreviews = this.props.mxEvent.getContent()[BUNDLED_LINK_PREVIEWS];
        if (Array.isArray(bundledLinkPreviews) && bundledLinkPreviews.length === 0) {
            this.snapshot.merge({
                previews: [],
                totalPreviewCount: 0,
                previewsLimited: false,
                overPreviewLimit: false,
            });
            return;
        }

        const loadMedia = this.visibility === PreviewVisibility.Visible;
        const previews =
            this.visibility <= PreviewVisibility.UserHidden
                ? []
                : await Promise.all(
                      this.links
                          .slice(0, this.limitPreviews ? MAX_PREVIEWS_WHEN_LIMITED : undefined)
                          .map((link) => this.fetcher.fetchPreview(link, loadMedia)),
                  );
        this.snapshot.merge({
            previews: previews.filter((p) => !!p),
            totalPreviewCount: this.links.length,
            previewsLimited: this.limitPreviews,
            overPreviewLimit: this.links.length > MAX_PREVIEWS_WHEN_LIMITED,
        });
    }

    /**
     * Trigger a recalculation of the links in an event.
     * @param eventElement
     */
    public async updateEventElement(eventElement: HTMLDivElement | HTMLSpanElement): Promise<void> {
        const newLinks = UrlPreviewGroupViewModel.findLinks([eventElement]);
        if (newLinks.some((x) => !this.links.includes(x)) || this.links.some((x) => !newLinks.includes(x))) {
            this.links = newLinks;
            return this.computeSnapshot();
        }
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

    /**
     * Update the view model about visible state of media.
     * @param urlPreviewVisible Whether media is hidden for this room or event.
     *
     * @returns A promise that completes when the snapshot has been recomputed.
     */
    public readonly updateMediaVisible = (mediaVisible: boolean): Promise<void> => {
        this.mediaVisible = mediaVisible;
        this.fetcher.clearCache();
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
        PosthogAnalytics.instance.trackEvent<UrlPreviewVisibilityChanged>({
            eventName: "UrlPreviewVisibilityChanged",
            previewKind: "LegacyCard",
            hasThumbnail: this.snapshot.current.previews.some((p) => !!p.image),
            previewCount: this.snapshot.current.previews.length,
            visible: this.urlPreviewEnabledByUser,
        });
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
}
