/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
import { GalleryComposerView, useViewModel } from "@element-hq/web-shared-components";

import { type GalleryComposerViewModel } from "../../../viewmodels/composer/GalleryComposerViewModel";

interface MessageAttachmentsProps {
    /**
     * The images and videos attached to the message.
     */
    vm: GalleryComposerViewModel;
    /**
     * Whether to show the strip, with its tile to add more, even when there is nothing attached.
     * By default it only appears once something is, or when there is a notice about files which
     * could not be attached.
     */
    alwaysShow?: boolean;
    className?: string;
}

/**
 * The images and videos attached to a message which is being written or edited.
 */
export function MessageAttachments({
    vm,
    alwaysShow,
    className,
}: Readonly<MessageAttachmentsProps>): JSX.Element | null {
    const { items, notice } = useViewModel(vm);
    if (!alwaysShow && items.length === 0 && !notice) return null;
    return <GalleryComposerView vm={vm} className={className} />;
}
