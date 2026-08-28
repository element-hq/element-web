/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, type JSX, type ReactNode } from "react";
import {
    TimelineView,
    useCreateAutoDisposedViewModel,
    useViewModel,
    type TimelineItem,
    DateSeparatorView,
    type DateSeparatorViewSnapshot,
    ReadMarker,
} from "@element-hq/web-shared-components";
import { InlineSpinner } from "@vector-im/compound-web";

import type { EventType, MatrixClient, MatrixEvent, RelationType, Relations, Room } from "matrix-js-sdk/src/matrix";
import { RoomTimelineViewModel } from "../../viewmodels/room/timeline/RoomTimelineViewModel";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import { LegacyEventTileAdapter } from "../views/rooms/LegacyEventTileAdapter";
import type { GetRelationsForEvent } from "../views/rooms/EventTile";
import { Layout } from "../../settings/enums/Layout";
import { useSettingValue } from "../../hooks/useSettings";
import { _t } from "../../languageHandler";
import type { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import type EditorStateTransfer from "../../utils/EditorStateTransfer";

/**
 * A date separator that only shows its label — no jump-to-date menu.
 *
 * It doesn't say `implements DateSeparatorViewActions`, because every member of
 * that type is optional and TypeScript rejects implementing such a type; the
 * class still satisfies what DateSeparatorView asks for.
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
    /**
     * How messages are laid out. RoomView watches this setting for us, so a change
     * arrives here as a new prop.
     */
    layout?: Layout;
    /** Keep the panel mounted but invisible (e.g. while search results are shown). */
    hidden?: boolean;
    /** Used by tiles for permalinks in message bodies and context menus. */
    permalinkCreator?: RoomPermalinkCreator;
    /** Whether tiles render URL previews under messages. */
    showUrlPreview?: boolean;
    /** Whether tiles render reactions under messages. */
    showReactions?: boolean;
    /** Set while a message is being edited; the matching tile renders the edit composer. */
    editState?: EditorStateTransfer;
}

/** Everything a timeline row needs from the panel to draw itself. */
interface RenderItemContext {
    room: Room;
    highlightedId: string | null;
    effectiveLayout: Layout;
    permalinkCreator?: RoomPermalinkCreator;
    showUrlPreview?: boolean;
    showReactions?: boolean;
    isTwelveHour: boolean;
    alwaysShowTimestamps: boolean;
    editState?: EditorStateTransfer;
    getRelationsForEvent: GetRelationsForEvent;
}

/** Draws one timeline row. Kept outside the component so it isn't redefined per render. */
function renderTimelineItem(item: TimelineItem, ctx: RenderItemContext): ReactNode {
    switch (item.kind) {
        case "date-separator": {
            const separatorVm = new StaticDateSeparatorViewModel(item.label ?? item.key);
            return <DateSeparatorView key={item.key} vm={separatorVm} />;
        }
        case "read-marker":
            // Rendered as a div because the timeline already puts each row in
            // its own list item.
            return (
                <ReadMarker
                    key={item.key}
                    eventId={item.key}
                    kind="current"
                    as="div"
                    label={_t("timeline|read_marker_new")}
                />
            );
        case "loading":
            return (
                <div
                    key={item.key}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: 32,
                        overflow: "hidden",
                    }}
                >
                    <InlineSpinner size={32} />
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
                    mxEvent={findEventById(ctx.room, item.key)!}
                    continuation={item.continuation}
                    lastInSection={item.lastInSection}
                    layout={ctx.effectiveLayout}
                    isSelectedEvent={ctx.highlightedId !== null && item.key === ctx.highlightedId}
                    // A tile treats any edit state it is given as its own, so
                    // only the message being edited may receive it.
                    editState={ctx.editState?.getEvent().getId() === item.key ? ctx.editState : undefined}
                    getRelationsForEvent={ctx.getRelationsForEvent}
                    permalinkCreator={ctx.permalinkCreator}
                    showUrlPreview={ctx.showUrlPreview}
                    showReactions={ctx.showReactions}
                    isTwelveHour={ctx.isTwelveHour}
                    alwaysShowTimestamps={ctx.alwaysShowTimestamps}
                />
            );
        default:
            return null;
    }
}

/**
 * New MVVM-based timeline panel, rendered behind the `feature_new_timeline` Labs flag.
 * Uses the shared TimelineView from shared-components with a RoomTimelineViewModel.
 */
export function NewTimelinePanel({
    room,
    highlightedEventId,
    layout,
    hidden,
    permalinkCreator,
    showUrlPreview,
    showReactions,
    editState,
}: Readonly<NewTimelinePanelProps>): JSX.Element {
    const client: MatrixClient = useMatrixClientContext();

    // Read here rather than passed in, so changing either setting redraws the tiles.
    const isTwelveHour = useSettingValue("showTwelveHourTimestamps");
    const alwaysShowTimestamps = useSettingValue("alwaysShowTimestamps");

    // Modern and Message Bubbles are fully supported. IRC layout is not yet: it
    // needs the draggable name column the old timeline provides, so fall back to
    // Modern for now (a known follow-up, listed on the tracking issue).
    const effectiveLayout = layout === Layout.IRC ? Layout.Group : (layout ?? Layout.Group);

    // Creating the view model does nothing on its own — it starts listening only
    // when start() is called in the effect below. React can build one of these and
    // throw it away, and anything it had already started would have leaked.
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

    useEffect(() => {
        // Load the syntax highlighter up front. Code blocks fetch it the first time
        // one is shown, and if that arrives late the block re-wraps after its row
        // has been measured and the timeline jumps. Loading it now means the
        // highlighting is ready before the first code block is drawn.
        void import("highlight.js");
    }, []);

    // How a tile finds the reactions and edits attached to its message. Without
    // this, no reactions are drawn at all.
    const getRelationsForEvent = useCallback(
        (eventId: string, relationType: RelationType | string, eventType: EventType | string): Relations | undefined =>
            room.getUnfilteredTimelineSet().relations?.getChildEventsForEvent(eventId, relationType, eventType),
        [room],
    );

    const snapshot = useViewModel(vm);
    const { highlightedEventId: highlightedId } = snapshot;

    const renderItem = useCallback(
        (item: TimelineItem): ReactNode =>
            renderTimelineItem(item, {
                room,
                highlightedId,
                effectiveLayout,
                permalinkCreator,
                showUrlPreview,
                showReactions,
                isTwelveHour,
                alwaysShowTimestamps,
                editState,
                getRelationsForEvent,
            }),
        [
            room,
            highlightedId,
            effectiveLayout,
            permalinkCreator,
            showUrlPreview,
            showReactions,
            isTwelveHour,
            alwaysShowTimestamps,
            editState,
            getRelationsForEvent,
        ],
    );

    return (
        <div
            className="mx_NewTimelinePanel mx_RoomView_messagePanel mx_RoomView_messageListWrapper"
            style={{ height: "100%", display: hidden ? "none" : undefined }}
        >
            <TimelineView vm={vm} renderItem={renderItem} />
        </div>
    );
}

/**
 * Look up a MatrixEvent by ID from the room's timelines.
 */
function findEventById(room: Room, eventId: string): MatrixEvent | undefined {
    return room.findEventById(eventId) ?? undefined;
}
