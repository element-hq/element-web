/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { PdfViewerCardView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import BaseCard from "./BaseCard";
import { _t } from "../../../languageHandler";
import {
    PdfViewerCardViewModel,
    type PdfViewerCardViewModelProps,
} from "../../../viewmodels/room/right-panel/PdfViewerCardViewModel";

interface Props {
    eventId: string;
    onClose: () => void;
    room: Room;
}

/**
 * Holds the view model, which is tied to a single attachment: remounting this on a change
 * of attachment gets the previous download cleaned up and a new one started.
 */
function PdfViewerCardBody({ eventId, room }: PdfViewerCardViewModelProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new PdfViewerCardViewModel({ eventId, room }));
    return <PdfViewerCardView vm={vm} />;
}

export function PdfViewerCard({ eventId, onClose, room }: Props): JSX.Element {
    return (
        <BaseCard
            header={_t("right_panel|pdf_viewer|title")}
            className="mx_PdfViewerCard"
            onClose={onClose}
            withoutScrollContainer
        >
            <PdfViewerCardBody key={`${room.roomId}/${eventId}`} eventId={eventId} room={room} />
        </BaseCard>
    );
}
