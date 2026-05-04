/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { memo, type JSX } from "react";
import { PinnedMessageBadge } from "@element-hq/web-shared-components";

import type { MatrixEvent, Relations } from "matrix-js-sdk/src/matrix";
import { Layout } from "../../../../settings/enums/Layout";
import { ReactionsRow } from "./ReactionsRow";
import type { ReactionsRowViewModel } from "../../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowViewModel";

type FooterProps = Readonly<{
    mxEvent: MatrixEvent;
    reactions: Relations | null;
    isRedacted?: boolean;
    isPinned: boolean;
    isOwnEvent: boolean;
    layout?: Layout;
    tileContentId: string;
    reactionsRowViewModel: ReactionsRowViewModel;
}>;

export const Footer = memo(function Footer({
    mxEvent,
    reactions,
    isRedacted,
    isPinned,
    isOwnEvent,
    layout,
    tileContentId,
    reactionsRowViewModel,
}: FooterProps): JSX.Element | undefined {
    if (!isPinned && !reactions) {
        return undefined;
    }

    const pinnedMessageBadge = isPinned ? (
        <PinnedMessageBadge aria-describedby={tileContentId} tabIndex={0} />
    ) : undefined;
    const reactionsRow = isRedacted ? undefined : (
        <ReactionsRow mxEvent={mxEvent} reactions={reactions} vm={reactionsRowViewModel} />
    );

    return (
        <>
            {(layout === Layout.Group || !isOwnEvent) && pinnedMessageBadge}
            {reactionsRow}
            {layout === Layout.Bubble && isOwnEvent && pinnedMessageBadge}
        </>
    );
});
