/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { M_POLL_START } from "matrix-events-sdk";

import { M_POLL_END, M_POLL_RESPONSE } from "../@types/polls";
import { MatrixClient } from "../client";
import { PollStartEvent } from "../extensible_events_v1/PollStartEvent";
import { MatrixEvent } from "./event";
import { Relations } from "./relations";
import { Room } from "./room";
import { TypedEventEmitter } from "./typed-event-emitter";

export enum PollEvent {
    New = "Poll.new",
    End = "Poll.end",
    Update = "Poll.update",
    Responses = "Poll.Responses",
    Destroy = "Poll.Destroy",
    UndecryptableRelations = "Poll.UndecryptableRelations",
}

export type PollEventHandlerMap = {
    [PollEvent.Update]: (event: MatrixEvent, poll: Poll) => void;
    [PollEvent.Destroy]: (pollIdentifier: string) => void;
    [PollEvent.End]: () => void;
    [PollEvent.Responses]: (responses: Relations) => void;
    [PollEvent.UndecryptableRelations]: (count: number) => void;
};

const filterResponseRelations = (
    relationEvents: MatrixEvent[],
    pollEndTimestamp: number,
): {
    responseEvents: MatrixEvent[];
} => {
    const responseEvents = relationEvents.filter((event) => {
        if (event.isDecryptionFailure()) {
            return;
        }
        return (
            M_POLL_RESPONSE.matches(event.getType()) &&
            // From MSC3381:
            // "Votes sent on or before the end event's timestamp are valid votes"
            event.getTs() <= pollEndTimestamp
        );
    });

    return { responseEvents };
};

export class Poll extends TypedEventEmitter<Exclude<PollEvent, PollEvent.New>, PollEventHandlerMap> {
    public readonly roomId: string;
    public readonly pollEvent: PollStartEvent;
    private _isFetchingResponses = false;
    private relationsNextBatch: string | undefined;
    private responses: null | Relations = null;
    private endEvent: MatrixEvent | undefined;
    /**
     * Keep track of undecryptable relations
     * As incomplete result sets affect poll results
     */
    private undecryptableRelationEventIds = new Set<string>();

    public constructor(public readonly rootEvent: MatrixEvent, private matrixClient: MatrixClient, private room: Room) {
        super();
        if (!this.rootEvent.getRoomId() || !this.rootEvent.getId()) {
            throw new Error("Invalid poll start event.");
        }
        this.roomId = this.rootEvent.getRoomId()!;
        this.pollEvent = this.rootEvent.unstableExtensibleEvent as unknown as PollStartEvent;
    }

    public get pollId(): string {
        return this.rootEvent.getId()!;
    }

    public get endEventId(): string | undefined {
        return this.endEvent?.getId();
    }

    public get isEnded(): boolean {
        return !!this.endEvent;
    }

    public get isFetchingResponses(): boolean {
        return this._isFetchingResponses;
    }

    public get undecryptableRelationsCount(): number {
        return this.undecryptableRelationEventIds.size;
    }

    public async getResponses(): Promise<Relations> {
        // if we have already fetched some responses
        // just return them
        if (this.responses) {
            return this.responses;
        }

        // if there is no fetching in progress
        // start fetching
        if (!this.isFetchingResponses) {
            await this.fetchResponses();
        }
        // return whatever responses we got from the first page
        return this.responses!;
    }

    /**
     *
     * @param event - event with a relation to the rootEvent
     * @returns void
     */
    public onNewRelation(event: MatrixEvent): void {
        if (M_POLL_END.matches(event.getType()) && this.validateEndEvent(event)) {
            this.endEvent = event;
            this.refilterResponsesOnEnd();
            this.emit(PollEvent.End);
        }

        // wait for poll responses to be initialised
        if (!this.responses) {
            return;
        }

        const pollEndTimestamp = this.endEvent?.getTs() || Number.MAX_SAFE_INTEGER;
        const { responseEvents } = filterResponseRelations([event], pollEndTimestamp);

        this.countUndecryptableEvents([event]);

        if (responseEvents.length) {
            responseEvents.forEach((event) => {
                this.responses!.addEvent(event);
            });

            this.emit(PollEvent.Responses, this.responses);
        }
    }

    private async fetchResponses(): Promise<void> {
        this._isFetchingResponses = true;

        // we want:
        // - stable and unstable M_POLL_RESPONSE
        // - stable and unstable M_POLL_END
        // so make one api call and filter by event type client side
        const allRelations = await this.matrixClient.relations(
            this.roomId,
            this.rootEvent.getId()!,
            "m.reference",
            undefined,
            {
                from: this.relationsNextBatch || undefined,
            },
        );

        await Promise.all(allRelations.events.map((event) => this.matrixClient.decryptEventIfNeeded(event)));

        const responses =
            this.responses ||
            new Relations("m.reference", M_POLL_RESPONSE.name, this.matrixClient, [M_POLL_RESPONSE.altName!]);

        const pollEndEvent = allRelations.events.find((event) => M_POLL_END.matches(event.getType()));

        if (this.validateEndEvent(pollEndEvent)) {
            this.endEvent = pollEndEvent;
            this.refilterResponsesOnEnd();
            this.emit(PollEvent.End);
        }

        const pollCloseTimestamp = this.endEvent?.getTs() || Number.MAX_SAFE_INTEGER;

        const { responseEvents } = filterResponseRelations(allRelations.events, pollCloseTimestamp);

        responseEvents.forEach((event) => {
            responses.addEvent(event);
        });

        this.relationsNextBatch = allRelations.nextBatch ?? undefined;
        this.responses = responses;
        this.countUndecryptableEvents(allRelations.events);

        // while there are more pages of relations
        // fetch them
        if (this.relationsNextBatch) {
            // don't await
            // we want to return the first page as soon as possible
            this.fetchResponses();
        } else {
            // no more pages
            this._isFetchingResponses = false;
        }

        // emit after updating _isFetchingResponses state
        this.emit(PollEvent.Responses, this.responses);
    }

    /**
     * Only responses made before the poll ended are valid
     * Refilter after an end event is recieved
     * To ensure responses are valid
     */
    private refilterResponsesOnEnd(): void {
        if (!this.responses) {
            return;
        }

        const pollEndTimestamp = this.endEvent?.getTs() || Number.MAX_SAFE_INTEGER;
        this.responses.getRelations().forEach((event) => {
            if (event.getTs() > pollEndTimestamp) {
                this.responses?.removeEvent(event);
            }
        });

        this.emit(PollEvent.Responses, this.responses);
    }

    private countUndecryptableEvents = (events: MatrixEvent[]): void => {
        const undecryptableEventIds = events
            .filter((event) => event.isDecryptionFailure())
            .map((event) => event.getId()!);

        const previousCount = this.undecryptableRelationsCount;
        this.undecryptableRelationEventIds = new Set([...this.undecryptableRelationEventIds, ...undecryptableEventIds]);

        if (this.undecryptableRelationsCount !== previousCount) {
            this.emit(PollEvent.UndecryptableRelations, this.undecryptableRelationsCount);
        }
    };

    private validateEndEvent(endEvent?: MatrixEvent): boolean {
        if (!endEvent) {
            return false;
        }
        /**
         * Repeated end events are ignored -
         * only the first (valid) closure event by origin_server_ts is counted.
         */
        if (this.endEvent && this.endEvent.getTs() < endEvent.getTs()) {
            return false;
        }

        /**
         * MSC3381
         * If a m.poll.end event is received from someone other than the poll creator or user with permission to redact
         * others' messages in the room, the event must be ignored by clients due to being invalid.
         */
        const roomCurrentState = this.room.currentState;
        const endEventSender = endEvent.getSender();
        return (
            !!endEventSender &&
            (endEventSender === this.rootEvent.getSender() ||
                roomCurrentState.maySendRedactionForEvent(this.rootEvent, endEventSender))
        );
    }
}

/**
 * Tests whether the event is a start, response or end poll event.
 *
 * @param event - Event to test
 * @returns true if the event is a poll event, else false
 */
export const isPollEvent = (event: MatrixEvent): boolean => {
    const eventType = event.getType();
    return M_POLL_START.matches(eventType) || M_POLL_RESPONSE.matches(eventType) || M_POLL_END.matches(eventType);
};
