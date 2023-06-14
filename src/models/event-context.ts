/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "./event";
import { Direction } from "./event-timeline";

export class EventContext {
    private timeline: MatrixEvent[];
    private ourEventIndex = 0;
    private paginateTokens: Record<Direction, string | null> = {
        [Direction.Backward]: null,
        [Direction.Forward]: null,
    };

    /**
     * Construct a new EventContext
     *
     * An eventcontext is used for circumstances such as search results, when we
     * have a particular event of interest, and a bunch of events before and after
     * it.
     *
     * It also stores pagination tokens for going backwards and forwards in the
     * timeline.
     *
     * @param ourEvent - the event at the centre of this context
     */
    public constructor(public readonly ourEvent: MatrixEvent) {
        this.timeline = [ourEvent];
    }

    /**
     * Get the main event of interest
     *
     * This is a convenience function for getTimeline()[getOurEventIndex()].
     *
     * @returns The event at the centre of this context.
     */
    public getEvent(): MatrixEvent {
        return this.timeline[this.ourEventIndex];
    }

    /**
     * Get the list of events in this context
     *
     * @returns An array of MatrixEvents
     */
    public getTimeline(): MatrixEvent[] {
        return this.timeline;
    }

    /**
     * Get the index in the timeline of our event
     */
    public getOurEventIndex(): number {
        return this.ourEventIndex;
    }

    /**
     * Get a pagination token.
     *
     * @param backwards -   true to get the pagination token for going
     */
    public getPaginateToken(backwards = false): string | null {
        return this.paginateTokens[backwards ? Direction.Backward : Direction.Forward];
    }

    /**
     * Set a pagination token.
     *
     * Generally this will be used only by the matrix js sdk.
     *
     * @param token -        pagination token
     * @param backwards -   true to set the pagination token for going
     *                                   backwards in time
     */
    public setPaginateToken(token?: string, backwards = false): void {
        this.paginateTokens[backwards ? Direction.Backward : Direction.Forward] = token ?? null;
    }

    /**
     * Add more events to the timeline
     *
     * @param events -      new events, in timeline order
     * @param atStart -   true to insert new events at the start
     */
    public addEvents(events: MatrixEvent[], atStart = false): void {
        // TODO: should we share logic with Room.addEventsToTimeline?
        // Should Room even use EventContext?

        if (atStart) {
            this.timeline = events.concat(this.timeline);
            this.ourEventIndex += events.length;
        } else {
            this.timeline = this.timeline.concat(events);
        }
    }
}
