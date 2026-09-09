/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type MessageComposerUrlPreviewSnapshotEntry,
    type MessageComposerUrlPreviewSnapshot,
} from "@element-hq/web-shared-components";
import { type UrlPreview } from "shared-types";
import { debounce } from "lodash";

import { UrlPreviewFetcher } from "../../utils/UrlPreviewFetcher";
import { linksIn } from "../../utils/UrlUtils";
import { type RoomMessageEventContent, type UnstableBundledUrlPreviewSingle } from "../../../@types/url-preview";
import type { UrlPreviewApi } from "../../modules/UrlPreviewApi";
import { type EncryptedFile } from "matrix-js-sdk/src/types";

export const DEBOUNCE_REQUEST_TIMEOUT_MS = 500;

/**
 * Props for {@link MessageComposerUrlPreviewViewModel}.
 *
 * Use {@link MessageComposerUrlPreviewViewModel.restoreFromMessage} instead of building these by
 * hand when the composer is editing an existing event, so its preview bundle is restored too.
 */
export interface MessageComposerUrlPreviewViewModelProps {
    client: MatrixClient;
    moduleUrlPreviewApi: UrlPreviewApi;
    /**
     * Whether composer URL previews should render at all.
     */
    visible: boolean;
    /**
     * Whether previews should carry a tooltip showing the target URL, i.e. the platform's
     * `needsUrlTooltips`. Only takes effect for previews whose title differs from their URL.
     */
    showTooltips: boolean;
    /**
     * Whether the url preview bundles lab flag is enabled
     */
    urlPreviewBundle: boolean;
    /**
     * Initial composer plaintext content.
     */
    content?: string;
    /**
     * Set the initial cache previews, used by restoreFromMessage
     */
    cachedEntries?: Map<string, MessageComposerUrlPreviewSnapshotEntry>;
}

export interface MessageComposerUrlPreviewViewModelRestoreProps {
    client: MatrixClient;
    moduleUrlPreviewApi: UrlPreviewApi;
    /**
     * Whether composer URL previews should render at all.
     */
    visible: boolean;
    /**
     * Whether previews should carry a tooltip showing the target URL, i.e. the platform's
     * `needsUrlTooltips`. Only takes effect for previews whose title differs from their URL.
     */
    showTooltips: boolean;
    /**
     * Whether the url preview bundles lab flag is enabled
     */
    urlPreviewBundle: boolean;
    /**
     * the message to restore previews from
     */
    mxEvent: MatrixEvent;
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

    /**
     * Maps `matched_url` to the {@link EncryptedFile} carrying its preview image, for previews
     * seeded from an event's existing bundle.
     *
     * Editing must resend the file as-is: its mxc points at the ciphertext, so re-uploading it
     * would encrypt the image a second time.
     */
    private readonly encryptedImageCache: Map<string, EncryptedFile> = new Map();

    /**
     * The list of all previews that are currently loading, loaded or failed to load
     * - loading entries are immediately added when computeSnapshot detects new link in the composer
     * - loaded/failed to load entries replaces the loading entry when it resolves
     * - not all previews in cache are displayed: the preview only selects the previews which link is in the composer,
     *   and preview.include is true where the preview has not been removed
     * - the cache is cleared when the composer is emptied: intentionally by user or by sending a message,
     *   this reloads all previews and forgets all preview.include states, causing all previously removed previews to be unremoved
     */
    private readonly previewCache: Map<string, MessageComposerUrlPreviewSnapshotEntry>;

    public constructor(props: MessageComposerUrlPreviewViewModelProps) {
        super(props, {
            entries: [],
            content: props.content ?? "",
            contentLinks: linksIn(props.content ?? ""),
            isModified: false,
        });
        this.urlPreviewVisible = props.visible;
        this.fetcher = new UrlPreviewFetcher(props.client, Date.now(), props.showTooltips, props.moduleUrlPreviewApi);
        this.content = this.snapshot.current.content;
        this.previewCache = props.cachedEntries ?? new Map();
        this.disposables.track(() => this.fetcher.dispose());

        // set state with initial content
        if (props.content) {
            this.computeSnapshot(props.content);
            // seeding from an existing event is not a user modification
            this.snapshot.merge({ isModified: false });
        }
    }

    public static restoreFromMessage(
        props: MessageComposerUrlPreviewViewModelRestoreProps,
    ): MessageComposerUrlPreviewViewModel {
        const content = props.mxEvent.getContent<RoomMessageEventContent>();
        const bundleContent = content["com.beeper.linkpreviews"];
        const linksInMessage = linksIn(content.body);
        const linksInBundle = new Set(bundleContent?.map((entry) => entry.matched_url));

        const urlVmProps: MessageComposerUrlPreviewViewModelProps = {
            client: props.client,
            moduleUrlPreviewApi: props.moduleUrlPreviewApi,
            visible: props.visible,
            showTooltips: props.showTooltips,
            urlPreviewBundle: props.urlPreviewBundle,
            content: content.body,
        };

        if (props.urlPreviewBundle && bundleContent !== undefined) {
            urlVmProps.cachedEntries = new Map(
                bundleContent
                    .map((entry): [string, MessageComposerUrlPreviewSnapshotEntry] => [
                        entry.matched_url,
                        {
                            // previewFromBundle is async (it falls back to a server request when the
                            // bundle carries only matched_url), so the bundled entries start out
                            // loading and are resolved by resolveBundledPreviews below.
                            status: "loading",
                            include: true,
                            matched_url: entry.matched_url,
                        },
                    ])
                    .concat(
                        Array.from(linksInMessage)
                            .filter((link) => !linksInBundle.has(link))
                            .map((link): [string, MessageComposerUrlPreviewSnapshotEntry] => [
                                link,
                                { status: "failed", include: false, matched_url: link },
                            ]),
                    ),
            );
        }

        const urlVm = new MessageComposerUrlPreviewViewModel(urlVmProps);
        if (props.urlPreviewBundle && bundleContent !== undefined) {
            urlVm.resolveBundledPreviews(bundleContent, props.mxEvent);
        }
        return urlVm;
    }

    private computeSnapshot(content: string): void {
        const newLinks = linksIn(content);

        if (!this.urlPreviewVisible) {
            this.snapshot.set({
                entries: [],
                content,
                contentLinks: newLinks,
                isModified: this.snapshot.current.isModified,
            });
            return;
        }

        if (this.links.symmetricDifference(newLinks).size === 0) {
            // Skip if the URL set hasn't changed
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

                void this.fetcher.fetchPreview(link, true).then((fetched) => {
                    this.resolvePreview(link, fetched);
                });
            }

            return this.previewCache.get(link)!;
        });

        this.snapshot.set({ entries, content, contentLinks: newLinks, isModified: true });
    }

    /**
     * Replace a loading entry with the result of fetching its preview, in both the cache and the
     * current snapshot. A null preview means the link has no usable preview.
     *
     * Leaves {@link MessageComposerUrlPreviewSnapshot.isModified} alone: resolving a preview that
     * was already pending is not a user modification.
     */
    private resolvePreview(link: string, fetched: UrlPreview | null): void {
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

        const updatedEntry = this.previewCache.get(link);
        if (updatedEntry === undefined) return;

        const snapshot = this.snapshot.current;

        this.snapshot.set({
            content: snapshot.content,
            contentLinks: snapshot.contentLinks,
            entries: snapshot.entries.map((entry) =>
                entry.matched_url === updatedEntry.matched_url ? updatedEntry : entry,
            ),
            isModified: snapshot.isModified,
        });
    }

    /**
     * Resolve previews seeded from an event's existing MSC4095 bundle.
     *
     * The seeded entries are already in {@link previewCache} as `loading`, which stops
     * {@link computeSnapshot} from refetching them, so they have to be resolved here. Entries whose
     * bundle carries only `matched_url` fall back to a server request inside `previewFromBundle`.
     *
     * @param bundle The event's preview bundle.
     * @param mxEvent The event the bundle belongs to.
     */
    public readonly resolveBundledPreviews = (
        bundle: UnstableBundledUrlPreviewSingle[],
        mxEvent: MatrixEvent,
    ): void => {
        for (const single of bundle) {
            const encryptedImage = single["beeper:image:encryption"];
            if (encryptedImage !== undefined) {
                this.encryptedImageCache.set(single.matched_url, encryptedImage);
            }

            void this.fetcher.previewFromBundle(single, mxEvent, true).then((fetched) => {
                this.resolvePreview(single.matched_url, fetched);
            });
        }
    };

    /**
     * Trigger a recalculation of the links in the provided text.
     * @param content Plaintext from the message composer.
     */
    public updateWithText({ content, debounced }: { content?: string; debounced: boolean }): void {
        if (content !== undefined) {
            this.content = content;
        }

        if (content === "") {
            this.previewCache.clear();
            this.encryptedImageCache.clear();
            this.computeSnapshotDebounced.cancel();
            return this.computeSnapshot("");
        }

        if (debounced) {
            return this.computeSnapshotDebounced(this.content);
        } else {
            this.computeSnapshotDebounced.cancel();
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

    /**
     * Remove a preview of a URL and remembers it until cache is cleared
     * @param url A URL that has been previously requested since the last time composer is empty
     */
    public readonly removePreview = (url: string): void => {
        const entry = this.previewCache.get(url);
        if (entry === undefined) return;
        entry.include = false;

        const snapshot = this.snapshot.current;

        this.snapshot.set({
            content: snapshot.content,
            contentLinks: snapshot.contentLinks,
            entries: snapshot.entries.filter((entry) => entry.include),
            isModified: true,
        });
    };

    /**
     * The {@link EncryptedFile}s of preview images seeded from an event's existing bundle, keyed by
     * `matched_url`, so that editing can resend them rather than re-uploading the image.
     */
    public getEncryptedImageCache(): ReadonlyMap<string, EncryptedFile> {
        return this.encryptedImageCache;
    }
}
