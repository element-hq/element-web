/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type ChangeEvent, type ClipboardEvent, type DragEvent, type JSX, useRef } from "react";
import classNames from "classnames";
import { CloseIcon, PlaySolidIcon, PlusIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { InlineSpinner, Text } from "@vector-im/compound-web";

import { useI18n } from "../../../core/i18n/i18nContext";
import { type ViewModel, useViewModel } from "../../../core/viewmodel";
import styles from "./GalleryComposerView.module.css";

/**
 * One image or video attached to the message, as shown in the strip.
 */
export interface GalleryComposerViewItem {
    /**
     * Identifies the item within the gallery. Must be stable across renders.
     */
    id: string;
    /**
     * Whether the item is an image or a video. Videos are marked with a play icon.
     */
    type: "image" | "video";
    /**
     * File name of the item, used to describe it to assistive technology.
     */
    name: string;
    /**
     * Source of the preview. An item without one shows an empty tile.
     */
    previewUrl?: string;
    /**
     * Whether `previewUrl` is a video, of which the first frame is shown, rather than an image.
     */
    previewIsVideo?: boolean;
    /**
     * Whether the preview is still being prepared. Shows a spinner.
     */
    loading?: boolean;
}

/**
 * The state of the attachments the view renders.
 */
export interface GalleryComposerViewSnapshot {
    /**
     * The items of the gallery, in the order they will be sent.
     */
    items: GalleryComposerViewItem[];
    /**
     * Whether more items can be added. False once the gallery is full.
     */
    canAddMore: boolean;
    /**
     * Describes how full the gallery is, e.g. "3 of 60 items". The accessible name of the list.
     */
    countLabel: string;
    /**
     * Optional message explaining why some files were not added.
     */
    notice?: string;
    /**
     * Whether every control is disabled, e.g. while the gallery is being sent.
     */
    disabled?: boolean;
}

/**
 * What the user can do with the attachments.
 */
export interface GalleryComposerViewActions {
    /**
     * Invoked with the files the user picked, dropped or pasted.
     */
    onAddFiles: (files: File[]) => void;
    /**
     * Invoked when the user removes an item.
     */
    onRemoveItem: (id: string) => void;
    /**
     * Invoked when the user activates an item, to see it at full size. Items are not interactive
     * without it.
     */
    onOpenItem?: (id: string) => void;
}

/**
 * The view model of {@link GalleryComposerView}.
 */
export type GalleryComposerViewModel = ViewModel<GalleryComposerViewSnapshot, GalleryComposerViewActions>;

interface GalleryComposerViewProps {
    /**
     * The view model for the component.
     */
    vm: GalleryComposerViewModel;
    /**
     * Optional host CSS class.
     */
    className?: string;
}

/**
 * The images and videos attached to a message which is being written or edited: a strip of small
 * previews, each of which can be removed, with a tile to add more. Made to sit inside a message
 * composer, whose text is sent with the attachments.
 *
 * More items can also be added by dropping files onto the view or by pasting them.
 *
 * @example
 * ```tsx
 * <GalleryComposerView vm={galleryComposerViewModel} />
 * ```
 */
export function GalleryComposerView({ vm, className }: Readonly<GalleryComposerViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { items, canAddMore, countLabel, notice, disabled } = useViewModel(vm);
    const fileInput = useRef<HTMLInputElement>(null);

    const onInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
        if (event.target.files?.length) vm.onAddFiles(Array.from(event.target.files));
        // Reset the control so that picking the same file again is reported as a change.
        event.target.value = "";
    };

    const onDrop = (event: DragEvent<HTMLDivElement>): void => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        if (!disabled) vm.onAddFiles(Array.from(event.dataTransfer.files));
    };

    const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
        // Without this the browser does not deliver the drop, and opens the file instead.
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
    };

    const onPaste = (event: ClipboardEvent<HTMLDivElement>): void => {
        if (!event.clipboardData.files.length) return;
        event.preventDefault();
        if (!disabled) vm.onAddFiles(Array.from(event.clipboardData.files));
    };

    return (
        <div className={classNames(className, styles.root)} onDrop={onDrop} onDragOver={onDragOver} onPaste={onPaste}>
            <ul className={styles.grid} aria-label={countLabel}>
                {items.map((item) => {
                    const preview = (
                        <>
                            {item.loading ? (
                                <InlineSpinner aria-label={_t("common|loading")} role="progressbar" />
                            ) : item.previewUrl === undefined ? null : item.previewIsVideo ? (
                                <video
                                    className={styles.preview}
                                    src={item.previewUrl}
                                    aria-label={item.name}
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                            ) : (
                                <img className={styles.preview} src={item.previewUrl} alt={item.name} />
                            )}
                            {item.type === "video" && (
                                <span className={styles.video}>
                                    <PlaySolidIcon width="16" height="16" />
                                </span>
                            )}
                        </>
                    );
                    return (
                        <li key={item.id} className={styles.item}>
                            {/* The preview opens the item at full size, when the host allows it */}
                            {vm.onOpenItem ? (
                                <button
                                    type="button"
                                    className={styles.open}
                                    aria-label={_t("composer|gallery|view_item", { name: item.name })}
                                    title={_t("composer|gallery|view_item", { name: item.name })}
                                    onClick={(): void => vm.onOpenItem?.(item.id)}
                                >
                                    {preview}
                                </button>
                            ) : (
                                preview
                            )}
                            <button
                                type="button"
                                className={styles.remove}
                                aria-label={_t("composer|gallery|remove_item", { name: item.name })}
                                title={_t("action|remove")}
                                disabled={disabled}
                                onClick={(): void => vm.onRemoveItem(item.id)}
                            >
                                <CloseIcon width="16" height="16" />
                            </button>
                        </li>
                    );
                })}
                {canAddMore && (
                    <li className={styles.item}>
                        <button
                            type="button"
                            className={styles.add}
                            disabled={disabled}
                            aria-label={_t("composer|gallery|add_more")}
                            title={_t("composer|gallery|add_more")}
                            onClick={(): void => fileInput.current?.click()}
                        >
                            <PlusIcon width="24" height="24" />
                        </button>
                    </li>
                )}
            </ul>
            <input
                ref={fileInput}
                type="file"
                className={styles.fileInput}
                data-testid="gallery-composer-file-input"
                accept="image/*,video/*"
                multiple
                tabIndex={-1}
                aria-hidden="true"
                onChange={onInputChange}
            />
            {notice && (
                <Text as="p" size="sm" className={styles.notice} role="status">
                    {notice}
                </Text>
            )}
        </div>
    );
}
