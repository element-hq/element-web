/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixEvent, type Relations, type RelationType } from "matrix-js-sdk/src/matrix";

/** Looks up relations for an event by relation and event type. */
export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

/** Inputs for fetching EventTile reaction relations. */
export interface EventTileReactionRelationsInput {
    /** Matrix event rendered by the tile. */
    mxEvent: MatrixEvent;
    /** Whether reactions are enabled for the tile. */
    showReactions?: boolean;
    /** Relation lookup function supplied by the timeline. */
    getRelationsForEvent?: GetRelationsForEvent;
}

/** Relation type used for EventTile reaction annotations. */
export const EVENT_TILE_REACTION_RELATION_TYPE = "m.annotation";

/** Event type used for EventTile reaction annotations. */
export const EVENT_TILE_REACTION_EVENT_TYPE = EventType.Reaction;

/** Whether a created relation event should refresh EventTile reactions. */
export function isEventTileReactionRelation(relationType: string, eventType: string): boolean {
    return relationType === EVENT_TILE_REACTION_RELATION_TYPE && eventType === EVENT_TILE_REACTION_EVENT_TYPE;
}

/** Fetches reaction relations for EventTile when reactions are enabled. */
export function getEventTileReactionRelations({
    mxEvent,
    showReactions,
    getRelationsForEvent,
}: EventTileReactionRelationsInput): Relations | null {
    if (!showReactions || !getRelationsForEvent) {
        return null;
    }

    return (
        getRelationsForEvent(mxEvent.getId()!, EVENT_TILE_REACTION_RELATION_TYPE, EVENT_TILE_REACTION_EVENT_TYPE) ??
        null
    );
}
