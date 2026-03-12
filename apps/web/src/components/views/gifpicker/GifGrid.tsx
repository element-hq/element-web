/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useMemo, useRef } from "react";

import { type KlipyGifResult, pickBestFormat } from "../../../gif/KlipyGifService";
import { _t } from "../../../languageHandler";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";

/** Number of GIF items per row - must match CSS grid-template-columns */
export const GIFS_PER_ROW = 2;

interface GifGridProps {
    results: KlipyGifResult[];
    onSelect: (gif: KlipyGifResult) => void;
    onLoadMore?: () => void;
    loading: boolean;
}

/**
 * A responsive grid of GIF thumbnail previews with full keyboard navigation.
 * Uses the pickBestFormat preview fallback chain for fast loading and supports infinite scroll via IntersectionObserver.
 */
export function GifGrid({ results, onSelect, onLoadMore, loading }: GifGridProps): JSX.Element {
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!onLoadMore || !sentinelRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && !loading) {
                    onLoadMore();
                }
            },
            { rootMargin: "200px" },
        );

        const sentinel = sentinelRef.current;
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [onLoadMore, loading]);

    const handleClick = useCallback(
        (gif: KlipyGifResult) => (): void => {
            onSelect(gif);
        },
        [onSelect],
    );

    // Group results into rows for proper grid accessibility
    const rows = useMemo(() => {
        const result: KlipyGifResult[][] = [];
        for (let i = 0; i < results.length; i += GIFS_PER_ROW) {
            result.push(results.slice(i, i + GIFS_PER_ROW));
        }
        return result;
    }, [results]);

    if (results.length === 0 && !loading) {
        return (
            <div className="mx_GifPicker_empty">
                <span>{_t("composer|gif_no_results")}</span>
            </div>
        );
    }

    return (
        <>
            <div className="mx_GifPicker_grid" role="grid" aria-label={_t("composer|gif_grid_label")}>
                {rows.map((row, rowIndex) => (
                    <div key={rowIndex} role="row">
                        {row.map((gif) => {
                            const preview = pickBestFormat(gif).preview;
                            return (
                                <div role="gridcell" key={gif.id}>
                                    <RovingAccessibleButton
                                        className="mx_GifPicker_gridItem"
                                        onClick={handleClick(gif)}
                                        title={gif.content_description}
                                        aria-label={gif.content_description || _t("composer|gif_item")}
                                    >
                                        <img
                                            src={preview.url}
                                            alt=""
                                            loading="lazy"
                                            width={preview.width}
                                            height={preview.height}
                                        />
                                    </RovingAccessibleButton>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
            {onLoadMore && <div ref={sentinelRef} className="mx_GifPicker_sentinel" />}
        </>
    );
}
