/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useCallback, useEffect, useRef } from "react";

import { type KlipyGifResult, pickBestFormat } from "../../../gif/KlipyGifService";
import { _t } from "../../../languageHandler";

interface GifGridProps {
    results: KlipyGifResult[];
    onSelect: (gif: KlipyGifResult) => void;
    onLoadMore?: () => void;
    loading: boolean;
}

/**
 * A responsive grid of GIF thumbnail previews.
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

    const handleKeyDown = useCallback(
        (gif: KlipyGifResult) =>
            (e: React.KeyboardEvent): void => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(gif);
                }
            },
        [onSelect],
    );

    if (results.length === 0 && !loading) {
        return (
            <div className="mx_GifPicker_empty">
                <span>{_t("composer|gif_no_results")}</span>
            </div>
        );
    }

    return (
        <>
            <div className="mx_GifPicker_grid">
                {results.map((gif) => {
                    const preview = pickBestFormat(gif).preview;
                    return (
                        <button
                            key={gif.id}
                            className="mx_GifPicker_gridItem"
                            onClick={handleClick(gif)}
                            onKeyDown={handleKeyDown(gif)}
                            title={gif.content_description}
                            type="button"
                        >
                            <img
                                src={preview.url}
                                alt={gif.content_description}
                                loading="lazy"
                                width={preview.width}
                                height={preview.height}
                            />
                        </button>
                    );
                })}
            </div>
            {onLoadMore && <div ref={sentinelRef} className="mx_GifPicker_sentinel" />}
        </>
    );
}
