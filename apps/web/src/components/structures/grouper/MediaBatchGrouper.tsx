/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { DateSeparatorView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { BaseGrouper } from "./BaseGrouper";
import type MessagePanel from "../MessagePanel";
import { SeparatorKind, type WrappedEvent } from "../MessagePanel";
import { DateSeparatorViewModel } from "../../../viewmodels/room/timeline/DateSeparatorViewModel";
import { isImageMediaBatchEvent, sameMediaBatch } from "../../../utils/MediaBatch";

function DateSeparatorWrapper({ roomId, ts }: { roomId: string; ts: number }): ReactNode {
    const vm = useCreateAutoDisposedViewModel(() => new DateSeparatorViewModel({ roomId, ts }));
    return <DateSeparatorView vm={vm} className="mx_TimelineSeparator" />;
}

/**
 * Render consecutive standard Matrix image events that share media-batch metadata
 * as one visible timeline tile while preserving the underlying per-file events.
 */
export class MediaBatchGrouper extends BaseGrouper {
    public static canStartGroup = function (_panel: MessagePanel, { event, shouldShow }: WrappedEvent): boolean {
        return !!shouldShow && isImageMediaBatchEvent(event);
    };

    public constructor(
        public readonly panel: MessagePanel,
        public readonly firstEventAndShouldShow: WrappedEvent,
        public readonly prevEvent: MatrixEvent | null,
        public readonly lastShownEvent: MatrixEvent | undefined,
        nextEvent: WrappedEvent | null,
        nextEventTile: MatrixEvent | null,
    ) {
        super(panel, firstEventAndShouldShow, prevEvent, lastShownEvent, nextEvent, nextEventTile);
        this.events = [firstEventAndShouldShow];
    }

    public shouldGroup({ event, shouldShow }: WrappedEvent): boolean {
        if (!shouldShow) return false;
        if (!isImageMediaBatchEvent(event)) return false;
        if (!sameMediaBatch(this.firstEventAndShouldShow.event, event)) return false;
        if (event.getSender() !== this.firstEventAndShouldShow.event.getSender()) return false;
        if (event.getRoomId() !== this.firstEventAndShouldShow.event.getRoomId()) return false;
        if (this.panel.wantsSeparator(this.events[this.events.length - 1].event, event) !== SeparatorKind.None) return false;

        return true;
    }

    public add(wrappedEvent: WrappedEvent): void {
        const { event } = wrappedEvent;
        this.readMarker = this.readMarker || this.panel.readMarkerForEvent(event.getId()!, event === this.lastShownEvent);
        this.events.push(wrappedEvent);
    }

    public getTiles(): ReactNode[] {
        const ret: ReactNode[] = [];
        const first = this.events[0];
        const groupedEvents = this.events.map(({ event }) => event);
        const lastEvent = groupedEvents[groupedEvents.length - 1];

        if (this.panel.wantsSeparator(this.prevEvent, first.event) === SeparatorKind.Date) {
            const separatorRoomId = first.event.getRoomId()!;
            const ts = first.event.getTs();
            ret.push(
                <li key={`${separatorRoomId}-${ts}~`}>
                    <DateSeparatorWrapper roomId={separatorRoomId} ts={ts} />
                </li>,
            );
        }

        ret.push(
            ...this.panel.getTilesForEvent(
                this.prevEvent,
                first,
                lastEvent === this.lastShownEvent,
                true,
                null,
                null,
                groupedEvents,
            ),
        );

        if (this.readMarker) {
            ret.push(this.readMarker);
        }

        return ret;
    }

    public getNewPrevEvent(): MatrixEvent {
        return this.events[this.events.length - 1].event;
    }
}
