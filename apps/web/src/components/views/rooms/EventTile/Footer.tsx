/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { PinnedMessageBadge } from "@element-hq/web-shared-components";

import { Layout } from "../../../../settings/enums/Layout";
import type { EventTileViewSnapshot } from "../../../../viewmodels/room/EventTileViewModel";
import { ReactionsRow } from "./ReactionsRow";
import type { EventTileProps } from "./EventTilePresenter";

interface FooterProps {
    props: EventTileProps;
    snapshot: EventTileViewSnapshot;
    tileContentId: string;
}

export function Footer({ props, snapshot, tileContentId }: FooterProps): JSX.Element | undefined {
    if (!snapshot.isPinned && !snapshot.reactions) {
        return undefined;
    }

    const pinnedMessageBadge = snapshot.isPinned ? (
        <PinnedMessageBadge aria-describedby={tileContentId} tabIndex={0} />
    ) : undefined;
    const reactionsRow = props.isRedacted ? undefined : (
        <ReactionsRow mxEvent={props.mxEvent} reactions={snapshot.reactions} />
    );

    return (
        <>
            {(props.layout === Layout.Group || !snapshot.isOwnEvent) && pinnedMessageBadge}
            {reactionsRow}
            {props.layout === Layout.Bubble && snapshot.isOwnEvent && pinnedMessageBadge}
        </>
    );
}
