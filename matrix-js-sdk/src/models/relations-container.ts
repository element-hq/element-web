/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Relations } from "./relations";
import { EventType, RelationType } from "../@types/event";
import { EventStatus, MatrixEvent, MatrixEventEvent } from "./event";
import { EventTimelineSet } from "./event-timeline-set";
import { MatrixClient } from "../client";
import { Room } from "./room";

export class RelationsContainer {
    // A tree of objects to access a set of related children for an event, as in:
    // this.relations.get(parentEventId).get(relationType).get(relationEventType)
    private relations = new Map<string, Map<RelationType | string, Map<EventType | string, Relations>>>();

    public constructor(private readonly client: MatrixClient, private readonly room?: Room) {}

    /**
     * Get a collection of child events to a given event in this timeline set.
     *
     * @param eventId - The ID of the event that you'd like to access child events for.
     * For example, with annotations, this would be the ID of the event being annotated.
     * @param relationType - The type of relationship involved, such as "m.annotation", "m.reference", "m.replace", etc.
     * @param eventType - The relation event's type, such as "m.reaction", etc.
     * @throws If `eventId</code>, <code>relationType</code> or <code>eventType`
     * are not valid.
     *
     * @returns
     * A container for relation events or undefined if there are no relation events for
     * the relationType.
     */
    public getChildEventsForEvent(
        eventId: string,
        relationType: RelationType | string,
        eventType: EventType | string,
    ): Relations | undefined {
        return this.relations.get(eventId)?.get(relationType)?.get(eventType);
    }

    public getAllChildEventsForEvent(parentEventId: string): MatrixEvent[] {
        const relationsForEvent =
            this.relations.get(parentEventId) ?? new Map<RelationType | string, Map<EventType | string, Relations>>();
        const events: MatrixEvent[] = [];
        for (const relationsRecord of relationsForEvent.values()) {
            for (const relations of relationsRecord.values()) {
                events.push(...relations.getRelations());
            }
        }
        return events;
    }

    /**
     * Set an event as the target event if any Relations exist for it already.
     * Child events can point to other child events as their parent, so this method may be
     * called for events which are also logically child events.
     *
     * @param event - The event to check as relation target.
     */
    public aggregateParentEvent(event: MatrixEvent): void {
        const relationsForEvent = this.relations.get(event.getId()!);
        if (!relationsForEvent) return;

        for (const relationsWithRelType of relationsForEvent.values()) {
            for (const relationsWithEventType of relationsWithRelType.values()) {
                relationsWithEventType.setTargetEvent(event);
            }
        }
    }

    /**
     * Add relation events to the relevant relation collection.
     *
     * @param event - The new child event to be aggregated.
     * @param timelineSet - The event timeline set within which to search for the related event if any.
     */
    public aggregateChildEvent(event: MatrixEvent, timelineSet?: EventTimelineSet): void {
        if (event.isRedacted() || event.status === EventStatus.CANCELLED) {
            return;
        }

        const relation = event.getRelation();
        if (!relation) return;

        const onEventDecrypted = (): void => {
            if (event.isDecryptionFailure()) {
                // This could for example happen if the encryption keys are not yet available.
                // The event may still be decrypted later. Register the listener again.
                event.once(MatrixEventEvent.Decrypted, onEventDecrypted);
                return;
            }

            this.aggregateChildEvent(event, timelineSet);
        };

        // If the event is currently encrypted, wait until it has been decrypted.
        if (event.isBeingDecrypted() || event.shouldAttemptDecryption()) {
            event.once(MatrixEventEvent.Decrypted, onEventDecrypted);
            return;
        }

        const { event_id: relatesToEventId, rel_type: relationType } = relation;
        const eventType = event.getType();

        let relationsForEvent = this.relations.get(relatesToEventId!);
        if (!relationsForEvent) {
            relationsForEvent = new Map<RelationType | string, Map<EventType | string, Relations>>();
            this.relations.set(relatesToEventId!, relationsForEvent);
        }

        let relationsWithRelType = relationsForEvent.get(relationType!);
        if (!relationsWithRelType) {
            relationsWithRelType = new Map<EventType | string, Relations>();
            relationsForEvent.set(relationType!, relationsWithRelType);
        }

        let relationsWithEventType = relationsWithRelType.get(eventType);
        if (!relationsWithEventType) {
            relationsWithEventType = new Relations(relationType!, eventType, this.client);
            relationsWithRelType.set(eventType, relationsWithEventType);

            const room = this.room ?? timelineSet?.room;
            const relatesToEvent =
                timelineSet?.findEventById(relatesToEventId!) ??
                room?.findEventById(relatesToEventId!) ??
                room?.getPendingEvent(relatesToEventId!);
            if (relatesToEvent) {
                relationsWithEventType.setTargetEvent(relatesToEvent);
            }
        }

        relationsWithEventType.addEvent(event);
    }
}
