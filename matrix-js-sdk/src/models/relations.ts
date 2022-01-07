/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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

import { EventEmitter } from 'events';

import { EventStatus, MatrixEvent } from './event';
import { Room } from './room';
import { logger } from '../logger';
import { RelationType } from "../@types/event";

/**
 * A container for relation events that supports easy access to common ways of
 * aggregating such events. Each instance holds events that of a single relation
 * type and event type. All of the events also relate to the same original event.
 *
 * The typical way to get one of these containers is via
 * EventTimelineSet#getRelationsForEvent.
 */
export class Relations extends EventEmitter {
    private relationEventIds = new Set<string>();
    private relations = new Set<MatrixEvent>();
    private annotationsByKey: Record<string, Set<MatrixEvent>> = {};
    private annotationsBySender: Record<string, Set<MatrixEvent>> = {};
    private sortedAnnotationsByKey: [string, Set<MatrixEvent>][] = [];
    private targetEvent: MatrixEvent = null;
    private creationEmitted = false;

    /**
     * @param {RelationType} relationType
     * The type of relation involved, such as "m.annotation", "m.reference",
     * "m.replace", etc.
     * @param {String} eventType
     * The relation event's type, such as "m.reaction", etc.
     * @param {?Room} room
     * Room for this container. May be null for non-room cases, such as the
     * notification timeline.
     */
    constructor(
        public readonly relationType: RelationType | string,
        public readonly eventType: string,
        private readonly room: Room,
    ) {
        super();
    }

    /**
     * Add relation events to this collection.
     *
     * @param {MatrixEvent} event
     * The new relation event to be added.
     */
    public async addEvent(event: MatrixEvent) {
        if (this.relationEventIds.has(event.getId())) {
            return;
        }

        const relation = event.getRelation();
        if (!relation) {
            logger.error("Event must have relation info");
            return;
        }

        const relationType = relation.rel_type;
        const eventType = event.getType();

        if (this.relationType !== relationType || this.eventType !== eventType) {
            logger.error("Event relation info doesn't match this container");
            return;
        }

        // If the event is in the process of being sent, listen for cancellation
        // so we can remove the event from the collection.
        if (event.isSending()) {
            event.on("Event.status", this.onEventStatus);
        }

        this.relations.add(event);
        this.relationEventIds.add(event.getId());

        if (this.relationType === RelationType.Annotation) {
            this.addAnnotationToAggregation(event);
        } else if (this.relationType === RelationType.Replace && this.targetEvent) {
            const lastReplacement = await this.getLastReplacement();
            this.targetEvent.makeReplaced(lastReplacement);
        }

        event.on("Event.beforeRedaction", this.onBeforeRedaction);

        this.emit("Relations.add", event);

        this.maybeEmitCreated();
    }

    /**
     * Remove relation event from this collection.
     *
     * @param {MatrixEvent} event
     * The relation event to remove.
     */
    private async removeEvent(event: MatrixEvent) {
        if (!this.relations.has(event)) {
            return;
        }

        const relation = event.getRelation();
        if (!relation) {
            logger.error("Event must have relation info");
            return;
        }

        const relationType = relation.rel_type;
        const eventType = event.getType();

        if (this.relationType !== relationType || this.eventType !== eventType) {
            logger.error("Event relation info doesn't match this container");
            return;
        }

        this.relations.delete(event);

        if (this.relationType === RelationType.Annotation) {
            this.removeAnnotationFromAggregation(event);
        } else if (this.relationType === RelationType.Replace && this.targetEvent) {
            const lastReplacement = await this.getLastReplacement();
            this.targetEvent.makeReplaced(lastReplacement);
        }

        this.emit("Relations.remove", event);
    }

    /**
     * Listens for event status changes to remove cancelled events.
     *
     * @param {MatrixEvent} event The event whose status has changed
     * @param {EventStatus} status The new status
     */
    private onEventStatus = (event: MatrixEvent, status: EventStatus) => {
        if (!event.isSending()) {
            // Sending is done, so we don't need to listen anymore
            event.removeListener("Event.status", this.onEventStatus);
            return;
        }
        if (status !== EventStatus.CANCELLED) {
            return;
        }
        // Event was cancelled, remove from the collection
        event.removeListener("Event.status", this.onEventStatus);
        this.removeEvent(event);
    };

    /**
     * Get all relation events in this collection.
     *
     * These are currently in the order of insertion to this collection, which
     * won't match timeline order in the case of scrollback.
     * TODO: Tweak `addEvent` to insert correctly for scrollback.
     *
     * @return {Array}
     * Relation events in insertion order.
     */
    public getRelations() {
        return [...this.relations];
    }

    private addAnnotationToAggregation(event: MatrixEvent) {
        const { key } = event.getRelation();
        if (!key) {
            return;
        }

        let eventsForKey = this.annotationsByKey[key];
        if (!eventsForKey) {
            eventsForKey = this.annotationsByKey[key] = new Set();
            this.sortedAnnotationsByKey.push([key, eventsForKey]);
        }
        // Add the new event to the set for this key
        eventsForKey.add(event);
        // Re-sort the [key, events] pairs in descending order of event count
        this.sortedAnnotationsByKey.sort((a, b) => {
            const aEvents = a[1];
            const bEvents = b[1];
            return bEvents.size - aEvents.size;
        });

        const sender = event.getSender();
        let eventsFromSender = this.annotationsBySender[sender];
        if (!eventsFromSender) {
            eventsFromSender = this.annotationsBySender[sender] = new Set();
        }
        // Add the new event to the set for this sender
        eventsFromSender.add(event);
    }

    private removeAnnotationFromAggregation(event: MatrixEvent) {
        const { key } = event.getRelation();
        if (!key) {
            return;
        }

        const eventsForKey = this.annotationsByKey[key];
        if (eventsForKey) {
            eventsForKey.delete(event);

            // Re-sort the [key, events] pairs in descending order of event count
            this.sortedAnnotationsByKey.sort((a, b) => {
                const aEvents = a[1];
                const bEvents = b[1];
                return bEvents.size - aEvents.size;
            });
        }

        const sender = event.getSender();
        const eventsFromSender = this.annotationsBySender[sender];
        if (eventsFromSender) {
            eventsFromSender.delete(event);
        }
    }

    /**
     * For relations that have been redacted, we want to remove them from
     * aggregation data sets and emit an update event.
     *
     * To do so, we listen for `Event.beforeRedaction`, which happens:
     *   - after the server accepted the redaction and remote echoed back to us
     *   - before the original event has been marked redacted in the client
     *
     * @param {MatrixEvent} redactedEvent
     * The original relation event that is about to be redacted.
     */
    private onBeforeRedaction = async (redactedEvent: MatrixEvent) => {
        if (!this.relations.has(redactedEvent)) {
            return;
        }

        this.relations.delete(redactedEvent);

        if (this.relationType === RelationType.Annotation) {
            // Remove the redacted annotation from aggregation by key
            this.removeAnnotationFromAggregation(redactedEvent);
        } else if (this.relationType === RelationType.Replace && this.targetEvent) {
            const lastReplacement = await this.getLastReplacement();
            this.targetEvent.makeReplaced(lastReplacement);
        }

        redactedEvent.removeListener("Event.beforeRedaction", this.onBeforeRedaction);

        this.emit("Relations.redaction", redactedEvent);
    };

    /**
     * Get all events in this collection grouped by key and sorted by descending
     * event count in each group.
     *
     * This is currently only supported for the annotation relation type.
     *
     * @return {Array}
     * An array of [key, events] pairs sorted by descending event count.
     * The events are stored in a Set (which preserves insertion order).
     */
    public getSortedAnnotationsByKey() {
        if (this.relationType !== RelationType.Annotation) {
            // Other relation types are not grouped currently.
            return null;
        }

        return this.sortedAnnotationsByKey;
    }

    /**
     * Get all events in this collection grouped by sender.
     *
     * This is currently only supported for the annotation relation type.
     *
     * @return {Object}
     * An object with each relation sender as a key and the matching Set of
     * events for that sender as a value.
     */
    public getAnnotationsBySender() {
        if (this.relationType !== RelationType.Annotation) {
            // Other relation types are not grouped currently.
            return null;
        }

        return this.annotationsBySender;
    }

    /**
     * Returns the most recent (and allowed) m.replace relation, if any.
     *
     * This is currently only supported for the m.replace relation type,
     * once the target event is known, see `addEvent`.
     *
     * @return {MatrixEvent?}
     */
    public async getLastReplacement(): Promise<MatrixEvent | null> {
        if (this.relationType !== RelationType.Replace) {
            // Aggregating on last only makes sense for this relation type
            return null;
        }
        if (!this.targetEvent) {
            // Don't know which replacements to accept yet.
            // This method shouldn't be called before the original
            // event is known anyway.
            return null;
        }

        // the all-knowning server tells us that the event at some point had
        // this timestamp for its replacement, so any following replacement should definitely not be less
        const replaceRelation = this.targetEvent.getServerAggregatedRelation(RelationType.Replace);
        const minTs = replaceRelation && replaceRelation.origin_server_ts;

        const lastReplacement = this.getRelations().reduce((last, event) => {
            if (event.getSender() !== this.targetEvent.getSender()) {
                return last;
            }
            if (minTs && minTs > event.getTs()) {
                return last;
            }
            if (last && last.getTs() > event.getTs()) {
                return last;
            }
            return event;
        }, null);

        if (lastReplacement?.shouldAttemptDecryption()) {
            await lastReplacement.attemptDecryption(this.room.client.crypto);
        } else if (lastReplacement?.isBeingDecrypted()) {
            await lastReplacement.getDecryptionPromise();
        }

        return lastReplacement;
    }

    /*
     * @param {MatrixEvent} targetEvent the event the relations are related to.
     */
    public async setTargetEvent(event: MatrixEvent) {
        if (this.targetEvent) {
            return;
        }
        this.targetEvent = event;

        if (this.relationType === RelationType.Replace) {
            const replacement = await this.getLastReplacement();
            // this is the initial update, so only call it if we already have something
            // to not emit Event.replaced needlessly
            if (replacement) {
                this.targetEvent.makeReplaced(replacement);
            }
        }

        this.maybeEmitCreated();
    }

    private maybeEmitCreated() {
        if (this.creationEmitted) {
            return;
        }
        // Only emit we're "created" once we have a target event instance _and_
        // at least one related event.
        if (!this.targetEvent || !this.relations.size) {
            return;
        }
        this.creationEmitted = true;
        this.targetEvent.emit("Event.relationsCreated", this.relationType, this.eventType);
    }
}
