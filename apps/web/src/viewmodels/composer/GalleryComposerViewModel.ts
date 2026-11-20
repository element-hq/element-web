/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type GalleryComposerViewItem,
    type GalleryComposerViewModel as GalleryComposerViewModelInterface,
    type GalleryComposerViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../languageHandler";
import { fileSize } from "../../utils/FileUtils";
import { type GalleryItem, isGalleryFile, MAX_GALLERY_ITEMS } from "../../utils/gallery";
import { GalleryMedia } from "../../utils/GalleryMedia";
import Modal from "../../Modal";
import { GalleryImageView } from "../../components/views/elements/GalleryImageView";

/**
 * One attachment of a message being written or edited: either a file still to be uploaded, or an
 * item which is already part of the message being edited.
 */
export type GalleryComposerEntry = File | GalleryItem;

/**
 * Props for {@link GalleryComposerViewModel}.
 */
export interface GalleryComposerViewModelProps {
    /**
     * The attachments to start with: none for a new message, or the images and videos of the
     * message being edited.
     */
    items: GalleryComposerEntry[];
    /**
     * Largest file the content repository accepts, in bytes, if it has a limit.
     */
    maxFileSize?: number;
}

/** An entry together with the preview shown for it. */
interface PreviewedEntry {
    id: string;
    entry: GalleryComposerEntry;
    /** Set for items which are already part of the gallery, whose preview has to be fetched. */
    media?: GalleryMedia;
    previewUrl?: string;
    loading: boolean;
}

/**
 * View model for the attachments of a message being written or edited: tracks the images and
 * videos while the user adds and removes them, and prepares a preview of each one.
 */
export class GalleryComposerViewModel
    extends BaseViewModel<GalleryComposerViewSnapshot, GalleryComposerViewModelProps>
    implements GalleryComposerViewModelInterface
{
    private entries: PreviewedEntry[] = [];
    /** The attachments the view model started with, to tell whether the user changed them. */
    private readonly initialItems: GalleryComposerEntry[];
    private notice?: string;
    private nextId = 0;

    public constructor(props: GalleryComposerViewModelProps) {
        super(props, { items: [], canAddMore: true, countLabel: "" });

        const files = props.items.filter((item): item is File => item instanceof File);
        const existing = props.items.filter((item): item is GalleryItem => !(item instanceof File));
        this.entries = existing.map((item) => this.createEntryForItem(item));
        // Sets the snapshot.
        this.addFiles(files);
        this.initialItems = this.getItems();
    }

    private createEntryForFile(file: File): PreviewedEntry {
        return { id: `item-${this.nextId++}`, entry: file, previewUrl: URL.createObjectURL(file), loading: false };
    }

    private createEntryForItem(item: GalleryItem): PreviewedEntry {
        const entry: PreviewedEntry = {
            id: `item-${this.nextId++}`,
            entry: item,
            media: new GalleryMedia(item),
            loading: true,
        };
        void this.loadPreview(entry);
        return entry;
    }

    private async loadPreview(entry: PreviewedEntry): Promise<void> {
        try {
            entry.previewUrl = (await entry.media!.getThumbnailUrl()) ?? undefined;
        } catch (error) {
            // The item is still part of the gallery, it just has no preview.
            logger.warn("Unable to load the preview of a gallery item", error);
        }
        entry.loading = false;
        if (!this.isDisposed && this.entries.includes(entry)) this.updateSnapshot();
    }

    private releaseEntry(entry: PreviewedEntry): void {
        if (entry.media) {
            entry.media.destroy();
        } else if (entry.previewUrl) {
            URL.revokeObjectURL(entry.previewUrl);
        }
    }

    private static computeItem({ id, entry, media, previewUrl, loading }: PreviewedEntry): GalleryComposerViewItem {
        if (entry instanceof File) {
            const isVideo = entry.type.startsWith("video/");
            return {
                id,
                type: isVideo ? "video" : "image",
                name: entry.name || _t("common|attachment"),
                previewUrl,
                previewIsVideo: isVideo,
            };
        }

        // The preview of a video which was already sent is its thumbnail, an image.
        return { id, type: media!.isVideo ? "video" : "image", name: media!.name, previewUrl, loading };
    }

    private updateSnapshot(): void {
        this.snapshot.set({
            items: this.entries.map(GalleryComposerViewModel.computeItem),
            canAddMore: this.entries.length < MAX_GALLERY_ITEMS,
            countLabel: _t("gallery|composer|count", { count: this.entries.length, max: MAX_GALLERY_ITEMS }),
            notice: this.notice,
        });
    }

    /**
     * Add files to the gallery. Files which cannot be gallery items, are too large to upload or
     * do not fit are left out, and a notice tells the user why.
     */
    private addFiles(files: File[]): void {
        const { maxFileSize } = this.props;
        const media = files.filter(isGalleryFile);
        const uploadable = media.filter((file) => maxFileSize === undefined || file.size <= maxFileSize);
        const accepted = uploadable.slice(0, Math.max(0, MAX_GALLERY_ITEMS - this.entries.length));

        // Report the most specific reason only: one notice is easier to act on than three.
        if (accepted.length < uploadable.length) {
            this.notice = _t("gallery|composer|notice_too_many", { max: MAX_GALLERY_ITEMS });
        } else if (uploadable.length < media.length) {
            this.notice = _t("gallery|composer|notice_too_large", { limit: fileSize(maxFileSize!) });
        } else if (media.length < files.length) {
            this.notice = _t("gallery|composer|notice_unsupported");
        } else {
            this.notice = undefined;
        }

        this.entries = [...this.entries, ...accepted.map((file) => this.createEntryForFile(file))];
        this.updateSnapshot();
    }

    /**
     * The attachments as they currently stand, in order.
     */
    public getItems(): GalleryComposerEntry[] {
        return this.entries.map(({ entry }) => entry);
    }

    /**
     * Whether the user has added or removed attachments since the view model was created.
     */
    public get isModified(): boolean {
        const items = this.getItems();
        return (
            items.length !== this.initialItems.length || items.some((item, index) => item !== this.initialItems[index])
        );
    }

    /**
     * Remove every item, e.g. once they have been sent.
     */
    public clear(): void {
        for (const entry of this.entries) this.releaseEntry(entry);
        this.entries = [];
        this.notice = undefined;
        this.updateSnapshot();
    }

    /**
     * Set the size above which files are turned away.
     *
     * @param maxFileSize - Largest file the content repository accepts, in bytes, if it has a limit.
     */
    public setMaxFileSize(maxFileSize?: number): void {
        this.props = { ...this.props, maxFileSize };
    }

    public onAddFiles = (files: File[]): void => {
        this.addFiles(files);
    };

    public onOpenItem = (id: string): void => {
        const index = this.entries.findIndex((entry) => entry.id === id);
        if (index === -1) return;

        Modal.createDialog(
            GalleryImageView,
            { items: this.getItems(), initialIndex: index },
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    };

    public onRemoveItem = (id: string): void => {
        const entry = this.entries.find((candidate) => candidate.id === id);
        if (!entry) return;

        this.entries = this.entries.filter((candidate) => candidate !== entry);
        this.releaseEntry(entry);
        this.notice = undefined;
        this.updateSnapshot();
    };

    public dispose(): void {
        for (const entry of this.entries) this.releaseEntry(entry);
        super.dispose();
    }
}
