/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type CSSProperties, type JSX, type MouseEvent, useState } from "react";
import classNames from "classnames";
import { Blurhash } from "react-blurhash";
import { ImageErrorIcon, PlaySolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { HiddenMediaPlaceholder } from "../HiddenMediaPlaceholder";
import styles from "./GalleryBodyView.module.css";

/**
 * The most tiles the grid shows. A gallery with more items than this shows how many are left on
 * its last tile.
 */
export const GALLERY_BODY_MAX_TILES = 5;

/**
 * High-level rendering state for the gallery body view.
 */
export const enum GalleryBodyViewState {
    /** The media is hidden until the user chooses to show it. */
    HIDDEN = "HIDDEN",
    /** The grid of tiles is shown. */
    READY = "READY",
}

/**
 * Loading state of one tile.
 */
export const enum GalleryBodyViewItemState {
    /** The thumbnail is being downloaded or decrypted. */
    LOADING = "LOADING",
    /** The thumbnail can be shown. */
    READY = "READY",
    /** The thumbnail could not be downloaded, decrypted or displayed. */
    ERROR = "ERROR",
}

export interface GalleryBodyViewItem {
    /**
     * Identifies the item within its gallery. Must be stable across renders.
     */
    id: string;
    /**
     * Whether the item is an image or a video. Videos are marked with a play icon.
     */
    type: "image" | "video";
    /**
     * Loading state of the thumbnail.
     */
    state: GalleryBodyViewItemState;
    /**
     * Accessible name of the tile.
     */
    label: string;
    /**
     * Thumbnail source. A video without one shows only its play icon.
     */
    src?: string;
    /**
     * Blurhash shown until the thumbnail has loaded.
     */
    blurhash?: string;
    /**
     * Length of a video, formatted for display.
     */
    durationLabel?: string;
}

export interface GalleryBodyViewSnapshot {
    /**
     * Controls whether the grid or the hidden-media placeholder is rendered.
     */
    state: GalleryBodyViewState;
    /**
     * Accessible name of the gallery.
     */
    label: string;
    /**
     * The tiles to show, in order. At most {@link GALLERY_BODY_MAX_TILES} are rendered.
     */
    items: GalleryBodyViewItem[];
    /**
     * How many items of the gallery have no tile. Shown over the last tile when above zero.
     */
    moreCount: number;
    /**
     * Label of the button which reveals hidden media.
     */
    hiddenButtonLabel?: string;
    /**
     * Maximum rendered width of the grid, in pixels. Defaults to the width set by the host
     * stylesheet. Used for compact renderings such as reply quotes.
     */
    maxWidth?: number;
}

export interface GalleryBodyViewActions {
    /**
     * Invoked when a tile is activated.
     */
    onItemClick: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
    /**
     * Invoked when the thumbnail of a tile fails to display.
     */
    onItemError: (id: string) => void;
    /**
     * Invoked when the user chooses to reveal hidden media.
     */
    onHiddenButtonClick: () => void;
}

export type GalleryBodyViewModel = ViewModel<GalleryBodyViewSnapshot, GalleryBodyViewActions>;

interface GalleryBodyViewProps {
    /**
     * The view model for the component.
     */
    vm: GalleryBodyViewModel;
    /**
     * Optional host CSS class.
     */
    className?: string;
}

interface TileProps {
    item: GalleryBodyViewItem;
    /** How many items are left after this tile, to show over it. */
    moreCount: number;
    vm: GalleryBodyViewModel;
}

function Tile({ item, moreCount, vm }: TileProps): JSX.Element {
    const isError = item.state === GalleryBodyViewItemState.ERROR;
    const showThumbnail = item.state === GalleryBodyViewItemState.READY && !!item.src;
    // The blurhash stands in for the thumbnail, and would show through a transparent one.
    const [loadedSrc, setLoadedSrc] = useState<string>();
    const showBlurhash = !!item.blurhash && !isError && !(showThumbnail && loadedSrc === item.src);

    return (
        <button
            type="button"
            className={styles.tile}
            aria-label={item.label}
            onClick={(event): void => vm.onItemClick(item.id, event)}
        >
            {showBlurhash && <Blurhash className={styles.blurhash} hash={item.blurhash!} width="100%" height="100%" />}
            {showThumbnail && (
                <img
                    className={styles.thumbnail}
                    src={item.src}
                    alt=""
                    loading="lazy"
                    onLoad={(): void => setLoadedSrc(item.src)}
                    onError={(): void => vm.onItemError(item.id)}
                />
            )}
            {isError && <ImageErrorIcon className={styles.errorIcon} width="24" height="24" />}
            {item.type === "video" && !isError && moreCount === 0 && (
                <span className={styles.video}>
                    <PlaySolidIcon width="16" height="16" />
                    {item.durationLabel && <span className={styles.duration}>{item.durationLabel}</span>}
                </span>
            )}
            {moreCount > 0 && <span className={styles.more}>+{moreCount}</span>}
        </button>
    );
}

/**
 * Renders the body of a gallery message as a grid of image and video tiles.
 *
 * The grid adapts to the number of tiles, from a single frame up to
 * {@link GALLERY_BODY_MAX_TILES}; the last tile shows how many further items the gallery holds.
 * Each tile is a button which reports clicks through the view model, so the host can open the
 * item in a media viewer.
 *
 * @example
 * ```tsx
 * <GalleryBodyView vm={galleryBodyViewModel} />
 * ```
 */
export function GalleryBodyView({ vm, className }: Readonly<GalleryBodyViewProps>): JSX.Element | null {
    const { state, label, items, moreCount, hiddenButtonLabel, maxWidth } = useViewModel(vm);
    const tiles = items.slice(0, GALLERY_BODY_MAX_TILES);

    if (tiles.length === 0) return null;

    const style = maxWidth === undefined ? undefined : ({ "--GalleryBody-width": `${maxWidth}px` } as CSSProperties);

    if (state === GalleryBodyViewState.HIDDEN) {
        return (
            <div className={classNames(className, styles.grid)} data-layout={tiles.length} style={style}>
                <HiddenMediaPlaceholder className={styles.hidden} onClick={vm.onHiddenButtonClick}>
                    {hiddenButtonLabel}
                </HiddenMediaPlaceholder>
            </div>
        );
    }

    return (
        <div
            className={classNames(className, styles.grid)}
            role="group"
            aria-label={label}
            data-layout={tiles.length}
            style={style}
        >
            {tiles.map((item, index) => (
                <Tile key={item.id} item={item} moreCount={index === tiles.length - 1 ? moreCount : 0} vm={vm} />
            ))}
        </div>
    );
}
