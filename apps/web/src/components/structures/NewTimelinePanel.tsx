/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useMemo, type JSX, type ReactNode } from "react";
import { TimelineView, useCreateAutoDisposedViewModel, useViewModel, type TimelineItem, DateSeparatorView, type DateSeparatorViewSnapshot, ReadMarker } from "@element-hq/web-shared-components";
import type { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import { RoomTimelineViewModel } from "../../viewmodels/room/timeline/RoomTimelineViewModel";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import { LegacyEventTileAdapter } from "../views/rooms/LegacyEventTileAdapter";
import Spinner from "../views/elements/Spinner";

/**
 * Minimal static VM for DateSeparatorView — no jump-to menu, label only.
 *
 * `DateSeparatorViewActions` is a weak type (all members optional), so we
 * don't list it in `implements` (that trips TS2559); the instance still
 * satisfies the `DateSeparatorViewModel` intersection when passed as `vm`.
 */
class StaticDateSeparatorViewModel implements DateSeparatorViewSnapshot {
    public readonly label: string;
    public readonly jumpToEnabled = false;

    public constructor(label: string) {
        this.label = label;
    }

    public subscribe = (): (() => void) => (): void => {};
    public getSnapshot = (): DateSeparatorViewSnapshot => this;
}

interface NewTimelinePanelProps {
    room: Room;
    highlightedEventId?: string;
}

/**
 * New MVVM-based timeline panel, rendered behind the `feature_new_timeline` Labs flag.
 * Uses the shared TimelineView from shared-components with a RoomTimelineViewModel.
 */
export function NewTimelinePanel({ room, highlightedEventId }: NewTimelinePanelProps): JSX.Element {
    const client: MatrixClient = useMatrixClientContext();

    // RoomTimelineViewModel's constructor is intentionally side-effect-free
    // (no listener registration, no load() call) so that React's StrictMode
    // double-invoke of the useState initializer doesn't leak subscriptions on
    // the discarded instance. We wire it up via vm.start() in an effect below,
    // which React only runs against the retained instance.
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new RoomTimelineViewModel({
                client,
                room,
                initialEventId: highlightedEventId,
            }),
    );

    useEffect(() => {
        vm.start();
        // Disposal is handled by useCreateAutoDisposedViewModel; no cleanup needed here.
    }, [vm]);

    const snapshot = useViewModel(vm);
    const { highlightedEventId: highlightedId } = snapshot;

    const renderItem = useMemo(
        () =>
            (item: TimelineItem): ReactNode => {
                switch (item.kind) {
                    case "date-separator": {
                        const separatorVm = new StaticDateSeparatorViewModel(item.label ?? item.key);
                        return <DateSeparatorView key={item.key} vm={separatorVm} />;
                    }
                    case "read-marker":
                        return <ReadMarker key={item.key} eventId={item.key} kind="current" />;
                    case "loading":
                        return (
                            <div key={item.key} className="mx_RoomView_messagePanelSpinner">
                                <Spinner />
                            </div>
                        );
                    case "gap":
                        return <div key={item.key}>Gap</div>;
                    case "event":
                        // For now, all events go through the legacy adapter.
                        // As tiles are migrated to MVVM, this switch will
                        // send migrated types to their shared views instead.
                        return (
                            <LegacyEventTileAdapter
                                key={item.key}
                                mxEvent={findEventById(room, item.key)!}
                                continuation={item.continuation}
                                isSelectedEvent={highlightedId !== null && item.key === highlightedId}
                            />
                        );
                    default:
                        return null;
                }
            },
        [room, highlightedId],
    );

    return (
        <div
            className="mx_NewTimelinePanel mx_RoomView_messagePanel mx_RoomView_messageListWrapper"
            style={{ height: "100%" }}
        >
            <TimelineView vm={vm} renderItem={renderItem} />
        </div>
    );
}

/**
 * Look up a MatrixEvent by ID from the room's timelines.
 */
function findEventById(room: Room, eventId: string): import("matrix-js-sdk/src/matrix").MatrixEvent | undefined {
    return room.findEventById(eventId) ?? undefined;
}
