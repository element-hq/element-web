/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Text } from "@vector-im/compound-web";
import classNames from "classnames";

import { type UrlPreview } from "../../timeline/event-tile/UrlPreviewGroupView";
import styles from "./MessageComposerUrlPreview.module.css";
import { LinkSiteName, LinkTitle } from "../../timeline/event-tile/UrlPreviewGroupView/LinkPreview/LinkPreview";
import { useViewModel, type ViewModel } from "../../../core/viewmodel";

/** Snapshot data for rendering a URL preview attached to the composer. */
export interface MessageComposerUrlPreviewSnapshot {
    /** URL preview to render. */
    preview: UrlPreview | null;
}

/** Props for MessageComposerUrlPreviewView. */
export interface MessageComposerUrlPreviewProps {
    /**
     * The view model for the component.
     */
    vm: ViewModel<MessageComposerUrlPreviewSnapshot>;
    /**
     * Extra CSS classes to apply to the component.
     */
    className?: string;
}

/**
 * MessageComposerUrlPreviewView renders a preview of a single URL above the messasge composer.
 */
export function MessageComposerUrlPreviewView({ vm, className }: MessageComposerUrlPreviewProps): JSX.Element | null {
    const { preview } = useViewModel(vm);
    if (!preview) {
        return null;
    }
    return (
        <div className={classNames(className, styles.container)}>
            <div>
                {preview?.image?.imageThumb && (
                    <img className={styles.image} src={preview.image?.imageThumb} alt={preview.image.alt} />
                )}
                <div className={styles.text}>
                    <LinkSiteName {...preview} />
                    <LinkTitle {...preview} />
                    <Text className={styles.description}>{preview?.description}</Text>
                </div>
            </div>
        </div>
    );
}
