/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type MouseEvent } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    formatSeconds,
    GALLERY_BODY_MAX_TILES,
    GalleryBodyViewItemState,
    GalleryBodyViewState,
    type GalleryBodyViewItem,
    type GalleryBodyViewModel as GalleryBodyViewModelInterface,
    type GalleryBodyViewSnapshot,
} from "@element-hq/web-shared-components";

import Modal from "../../Modal";
import { _t } from "../../languageHandler";
import { GalleryMedia } from "../../utils/GalleryMedia";
import { BLURHASH_FIELD } from "../../utils/image-media";
import { type RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import { GalleryImageView } from "../../components/views/elements/GalleryImageView";

export interface GalleryBodyViewModelProps {
    /**
     * Gallery event being rendered.
     */
    mxEvent: MatrixEvent;
    /**
     * Whether the media should currently be shown instead of the hidden-media placeholder.
     */
    mediaVisible: boolean;
    /**
     * Optional maximum height of the grid, for compact renderings such as reply quotes.
     */
    maxImageHeight?: number;
    /**
     * Permalink helper passed to the media viewer.
     */
    permalinkCreator?: RoomPermalinkCreator;
    /**
     * Callback invoked when hidden media is revealed.
     */
    setMediaVisible?: (visible: boolean) => void;
}

// Width of the grid relative to its height, for every layout of more than one row.
const GRID_ASPECT_RATIO = 3 / 2;

/** One item of the gallery together with what is known about its thumbnail. */
interface Entry {
    /** Identifies the item within the gallery: its mxc URI, made unique if it appears twice. */
    id: string;
    media: GalleryMedia;
    state: GalleryBodyViewItemState;
    thumbnailUrl?: string;
    /** Whether loading the thumbnail has been started, so it is only done once. */
    loadStarted?: boolean;
}

/**
 * View model for the body of a gallery message: resolves the thumbnails of the items that have a
 * tile and opens the media viewer when a tile is activated.
 */
export class GalleryBodyViewModel
    extends BaseViewModel<GalleryBodyViewSnapshot, GalleryBodyViewModelProps>
    implements GalleryBodyViewModelInterface
{
    private entries: Entry[];
    private watchedEvent?: MatrixEvent;

    public constructor(props: GalleryBodyViewModelProps) {
        const entries = GalleryBodyViewModel.createEntries(props.mxEvent, []);
        super(props, GalleryBodyViewModel.computeSnapshot(props, entries));
        this.entries = entries;
        this.watchEvent(props.mxEvent);
    }

    /**
     * Build the entries for the items of an event, carrying over the entries of items which were
     * already known so their thumbnails are not loaded again when the gallery is edited.
     */
    private static createEntries(mxEvent: MatrixEvent, previous: Entry[]): Entry[] {
        const reusable = new Map(previous.map((entry) => [entry.id, entry]));
        const seen = new Map<string, number>();

        return GalleryMedia.forEvent(mxEvent).map((media) => {
            const occurrence = seen.get(media.mxc) ?? 0;
            seen.set(media.mxc, occurrence + 1);
            const id = occurrence === 0 ? media.mxc : `${media.mxc}#${occurrence}`;

            const existing = reusable.get(id);
            if (existing) {
                reusable.delete(id);
                media.destroy();
                return existing;
            }
            return { id, media, state: GalleryBodyViewItemState.LOADING };
        });
    }

    private static computeItem(entry: Entry, index: number, count: number): GalleryBodyViewItem {
        const { media } = entry;
        let label = media.isVideo
            ? _t("timeline|m.gallery|item_video", { index: index + 1, count })
            : _t("timeline|m.gallery|item_image", { index: index + 1, count });
        if (entry.state === GalleryBodyViewItemState.ERROR) {
            label = _t("timeline|m.gallery|item_error", { label });
        }

        const duration = media.item.info?.duration;
        return {
            id: entry.id,
            type: media.isVideo ? "video" : "image",
            state: entry.state,
            label,
            src: entry.thumbnailUrl,
            blurhash: media.item.info?.[BLURHASH_FIELD],
            durationLabel:
                media.isVideo && typeof duration === "number"
                    ? formatSeconds(duration / 1000, { minutesMinLength: 1 })
                    : undefined,
        };
    }

    private static computeSnapshot(props: GalleryBodyViewModelProps, entries: Entry[]): GalleryBodyViewSnapshot {
        const count = entries.length;
        const tiles = entries.slice(0, GALLERY_BODY_MAX_TILES);

        return {
            state: props.mediaVisible ? GalleryBodyViewState.READY : GalleryBodyViewState.HIDDEN,
            label: _t("timeline|m.gallery|summary", { count }),
            items: tiles.map((entry, index) => GalleryBodyViewModel.computeItem(entry, index, count)),
            moreCount: count - tiles.length,
            hiddenButtonLabel: _t("timeline|m.gallery|show_gallery"),
            maxWidth:
                props.maxImageHeight === undefined ? undefined : Math.round(props.maxImageHeight * GRID_ASPECT_RATIO),
        };
    }

    private watchEvent(mxEvent: MatrixEvent): void {
        this.unwatchEvent();
        this.watchedEvent = mxEvent;
        // An edit can add and remove items, and a late decryption supplies them for the first time.
        this.watchedEvent.on(MatrixEventEvent.Replaced, this.onEventContentChanged);
        this.watchedEvent.on(MatrixEventEvent.Decrypted, this.onEventContentChanged);
    }

    private unwatchEvent(): void {
        this.watchedEvent?.off(MatrixEventEvent.Replaced, this.onEventContentChanged);
        this.watchedEvent?.off(MatrixEventEvent.Decrypted, this.onEventContentChanged);
        this.watchedEvent = undefined;
    }

    private onEventContentChanged = (): void => {
        const previous = this.entries;
        this.entries = GalleryBodyViewModel.createEntries(this.props.mxEvent, previous);
        for (const entry of previous) {
            if (!this.entries.includes(entry)) entry.media.destroy();
        }
        this.updateSnapshot();
        this.loadThumbnailsIfVisible();
    };

    private updateSnapshot(): void {
        this.snapshot.set(GalleryBodyViewModel.computeSnapshot(this.props, this.entries));
    }

    /**
     * Start loading the thumbnails of the tiles, unless the media is hidden. Call once the view
     * model is in use, and again whenever the media becomes visible.
     */
    public loadThumbnailsIfVisible(): void {
        if (!this.props.mediaVisible) return;

        for (const entry of this.entries.slice(0, GALLERY_BODY_MAX_TILES)) {
            if (!entry.loadStarted) {
                entry.loadStarted = true;
                void this.loadThumbnail(entry);
            }
        }
    }

    private async loadThumbnail(entry: Entry): Promise<void> {
        let thumbnailUrl: string | null;
        try {
            thumbnailUrl = await entry.media.getThumbnailUrl();
        } catch (error) {
            logger.warn("Unable to load the thumbnail of a gallery item", error);
            this.setEntryState(entry, GalleryBodyViewItemState.ERROR);
            return;
        }

        entry.thumbnailUrl = thumbnailUrl ?? undefined;
        this.setEntryState(entry, GalleryBodyViewItemState.READY);
    }

    private setEntryState(entry: Entry, state: GalleryBodyViewItemState): void {
        entry.state = state;
        // The gallery may have been edited, or the tile removed, while the thumbnail was loading.
        if (this.isDisposed || !this.entries.includes(entry)) return;
        this.updateSnapshot();
    }

    public onItemClick = (id: string, event: MouseEvent<HTMLButtonElement>): void => {
        const index = this.entries.findIndex((entry) => entry.id === id);
        if (index === -1) return;

        const { x, y, width, height } = event.currentTarget.getBoundingClientRect();
        Modal.createDialog(
            GalleryImageView,
            {
                mxEvent: this.props.mxEvent,
                initialIndex: index,
                permalinkCreator: this.props.permalinkCreator,
                thumbnailInfo: { positionX: x, positionY: y, width, height },
            },
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    };

    public onItemError = (id: string): void => {
        const entry = this.entries.find((candidate) => candidate.id === id);
        if (!entry || entry.state === GalleryBodyViewItemState.ERROR) return;
        this.setEntryState(entry, GalleryBodyViewItemState.ERROR);
    };

    public onHiddenButtonClick = (): void => {
        this.props.setMediaVisible?.(true);
    };

    public setEvent(mxEvent: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        this.props = { ...this.props, mxEvent };
        this.watchEvent(mxEvent);
        this.onEventContentChanged();
    }

    public setMediaVisible(mediaVisible: boolean): void {
        if (this.props.mediaVisible === mediaVisible) return;

        this.props = { ...this.props, mediaVisible };
        this.updateSnapshot();
        this.loadThumbnailsIfVisible();
    }

    public setMaxImageHeight(maxImageHeight?: number): void {
        if (this.props.maxImageHeight === maxImageHeight) return;

        this.props = { ...this.props, maxImageHeight };
        this.updateSnapshot();
    }

    public setPermalinkCreator(permalinkCreator?: RoomPermalinkCreator): void {
        this.props = { ...this.props, permalinkCreator };
    }

    public setSetMediaVisible(setMediaVisible?: (visible: boolean) => void): void {
        this.props = { ...this.props, setMediaVisible };
    }

    public dispose(): void {
        this.unwatchEvent();
        for (const entry of this.entries) entry.media.destroy();
        super.dispose();
    }
}
