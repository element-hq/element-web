/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState, type JSX } from "react";
import { _t } from "../../../languageHandler";
import TextualBody from "./TextualBody";
import { type IBodyProps } from "./IBodyProps";
import type { FileInfo, ImageInfo, VideoInfo, AudioInfo, EncryptedFile } from "matrix-js-sdk/src/types";

export interface GalleryItemContent {
    itemtype: string;
    body: string;
    url?: string;
    file?: EncryptedFile;
    info?: FileInfo | ImageInfo | VideoInfo | AudioInfo;
}

export interface GalleryContent {
    msgtype: "dm.filament.gallery";
    body: string;
    format?: "org.matrix.custom.html";
    formatted_body?: string;
    itemtypes: GalleryItemContent[];
}

interface GalleryItemProps {
    item: GalleryItemContent;
    index: number;
    onClick: (index: number) => void;
    forExport?: boolean;
}

const GalleryItem: React.FC<GalleryItemProps> = ({ item, index, onClick, forExport }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    const imageUrl = item.url ?? item.file?.url;
    const imageInfo = item.info;
    const width = (imageInfo as ImageInfo | VideoInfo)?.w ?? 200;
    const height = (imageInfo as ImageInfo | VideoInfo)?.h ?? 200;

    const handleClick = (): void => {
        onClick(index);
    };

    const handleLoad = (): void => {
        setLoaded(true);
    };

    const handleError = (): void => {
        setError(true);
    };

    const aspectRatio = width / height || 1;
    const isWide = aspectRatio > 1.5;
    const isTall = aspectRatio < 0.67;

    let thumbnail: JSX.Element | null = null;
    if (!forExport && imageUrl && !error) {
        thumbnail = (
            <img
                src={imageUrl}
                alt={item.body}
                className="mx_MGalleryBody_item_thumbnail"
                style={{ opacity: loaded ? 1 : 0 }}
                onLoad={handleLoad}
                onError={handleError}
                onClick={handleClick}
                loading="lazy"
            />
        );
    } else if (forExport && imageUrl) {
        thumbnail = (
            <img src={imageUrl} alt={item.body} className="mx_MGalleryBody_item_thumbnail" onClick={handleClick} />
        );
    }

    let placeholder: JSX.Element | null = null;
    if (!loaded && !error) {
        placeholder = <div className="mx_MGalleryBody_item_placeholder" />;
    }

    const gridClass =
        index === 0
            ? "mx_MGalleryBody_item--large"
            : isWide
              ? "mx_MGalleryBody_item--wide"
              : isTall
                ? "mx_MGalleryBody_item--tall"
                : "mx_MGalleryBody_item--square";

    return (
        <div className={`mx_MGalleryBody_item ${gridClass}`} onClick={handleClick}>
            {placeholder}
            {thumbnail}
            {error && <div className="mx_MGalleryBody_item_error">{_t("common|attachment")}</div>}
        </div>
    );
};

const MGalleryBody: React.FC<IBodyProps> = (props) => {
    const content = props.mxEvent.getContent<GalleryContent>();
    const items = content.itemtypes ?? [];
    const hasCaption = content.body && content.body.length > 0;

    const handleItemClick = (index: number): void => {
        const item = items[index];
        if (item.url) {
            window.open(item.url, "_blank");
        }
    };

    const renderImageGrid = (): React.ReactNode => {
        if (items.length === 0) {
            return <div className="mx_MGalleryBody_empty">{_t("common|attachment")}</div>;
        }

        const displayItems = items.slice(0, 4);
        const remainingCount = items.length - 4;

        return (
            <div className="mx_MGalleryBody_grid">
                {displayItems.map((item, index) => (
                    <GalleryItem
                        key={index}
                        item={item}
                        index={index}
                        onClick={handleItemClick}
                        forExport={props.forExport}
                    />
                ))}
                {remainingCount > 0 && (
                    <div className="mx_MGalleryBody_item mx_MGalleryBody_item--more">+{remainingCount}</div>
                )}
            </div>
        );
    };

    return (
        <div className="mx_MGalleryBody">
            {renderImageGrid()}
            {hasCaption && <TextualBody {...props} />}
        </div>
    );
};

export default MGalleryBody;
