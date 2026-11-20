/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type ComponentProps, type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import { GalleryMedia } from "../../../utils/GalleryMedia";
import { LocalMedia } from "../../../utils/LocalMedia";
import { type GalleryItem } from "../../../utils/gallery";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import ImageView from "./ImageView";
import Spinner from "./Spinner";

interface GalleryImageViewProps {
    /**
     * The gallery message whose items are shown.
     */
    mxEvent?: MatrixEvent;
    /**
     * The media to show when it is not that of a message: the attachments of a message being
     * written or edited, both files still to be sent and items the message already has.
     * Ignored when `mxEvent` is given.
     */
    items?: Array<File | GalleryItem>;
    /**
     * Position of the item to show first, among the displayable items of the gallery.
     */
    initialIndex: number;
    /**
     * Creates the link to the message shown in the panel.
     */
    permalinkCreator?: RoomPermalinkCreator;
    /**
     * Where the tile of the first item is on screen, so the viewer can grow out of it.
     */
    thumbnailInfo?: ComponentProps<typeof ImageView>["thumbnailInfo"];
    /**
     * Invoked when the viewer is closed.
     */
    onFinished(): void;
}

/** What is known about the source of the item being shown. */
type Source = { status: "loading" } | { status: "ready"; url: string } | { status: "error" };

/** One piece of media the viewer can show. */
type ViewerMedia = GalleryMedia | LocalMedia;

function mediaFor(mxEvent?: MatrixEvent, items: Array<File | GalleryItem> = []): ViewerMedia[] {
    if (mxEvent) return GalleryMedia.forEvent(mxEvent);
    return items.map((item) => (item instanceof File ? new LocalMedia(item) : new GalleryMedia(item)));
}

/**
 * The media viewer for a gallery message, or for the attachments of a message being written:
 * shows one item at a time in the image view and steps through the others with the previous and
 * next buttons or the arrow keys.
 */
export function GalleryImageView({
    mxEvent,
    items: attachments,
    initialIndex,
    permalinkCreator,
    thumbnailInfo,
    onFinished,
}: Readonly<GalleryImageViewProps>): JSX.Element | null {
    // The viewer owns its media rather than borrowing the timeline's, which is released when the
    // message scrolls out of view.
    const items = useMemo(() => mediaFor(mxEvent, attachments), [mxEvent, attachments]);
    useEffect(() => {
        return () => items.forEach((item) => item.destroy());
    }, [items]);

    const [index, setIndex] = useState(() => Math.max(0, Math.min(initialIndex, items.length - 1)));
    // The viewer only grows out of a tile when it opens, not when coming back to the first item.
    const [hasNavigated, setHasNavigated] = useState(false);
    const [sources, setSources] = useState<ReadonlyMap<ViewerMedia, Source>>(new Map());
    const current = items.at(index);

    useEffect(() => {
        if (!current || sources.has(current)) return;

        const setSource = (source: Source): void => setSources((previous) => new Map(previous).set(current, source));
        setSource({ status: "loading" });
        current.getSourceUrl().then(
            (url) => setSource(url ? { status: "ready", url } : { status: "error" }),
            (error) => {
                logger.warn("Unable to load a gallery item", error);
                setSource({ status: "error" });
            },
        );
    }, [current, sources]);

    const onPrevious = useCallback(() => {
        setHasNavigated(true);
        setIndex((value) => Math.max(0, value - 1));
    }, []);
    const onNext = useCallback(() => {
        setHasNavigated(true);
        setIndex((value) => Math.min(items.length - 1, value + 1));
    }, [items]);

    if (!current) return null;

    const position = items.indexOf(current);
    const source = sources.get(current) ?? { status: "loading" };

    let placeholder: JSX.Element | undefined;
    if (source.status === "loading") {
        placeholder = <Spinner />;
    } else if (source.status === "error") {
        placeholder = (
            <div className="mx_ImageView_placeholder" role="alert">
                {current.isVideo ? _t("timeline|m.gallery|error_video") : _t("timeline|m.image|error")}
            </div>
        );
    }

    return (
        <ImageView
            // Each item gets a view of its own, so zoom and rotation start afresh.
            key={position}
            src={source.status === "ready" ? source.url : ""}
            name={current.name}
            title={_t("timeline|m.gallery|viewer_title", {
                name: current.name,
                index: position + 1,
                count: items.length,
            })}
            width={current.info?.w}
            height={current.info?.h}
            fileSize={current.info?.size}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            mediaEventHelper={current.helper}
            isVideo={current.isVideo}
            placeholder={placeholder}
            thumbnailInfo={hasNavigated ? undefined : thumbnailInfo}
            onPrevious={position > 0 ? onPrevious : undefined}
            onNext={position < items.length - 1 ? onNext : undefined}
            onFinished={onFinished}
        />
    );
}
