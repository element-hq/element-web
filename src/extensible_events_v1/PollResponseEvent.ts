/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import { ExtensibleEvent } from "./ExtensibleEvent";
import { M_POLL_RESPONSE, PollResponseEventContent, PollResponseSubtype } from "../@types/polls";
import { ExtensibleEventType, IPartialEvent, isEventTypeSame, REFERENCE_RELATION } from "../@types/extensible_events";
import { InvalidEventError } from "./InvalidEventError";
import { PollStartEvent } from "./PollStartEvent";

/**
 * Represents a poll response event.
 */
export class PollResponseEvent extends ExtensibleEvent<PollResponseEventContent> {
    private internalAnswerIds: string[] = [];
    private internalSpoiled = false;

    /**
     * The provided answers for the poll. Note that this may be falsy/unpredictable if
     * the `spoiled` property is true.
     */
    public get answerIds(): string[] {
        return this.internalAnswerIds;
    }

    /**
     * The poll start event ID referenced by the response.
     */
    public readonly pollEventId: string;

    /**
     * Whether the vote is spoiled.
     */
    public get spoiled(): boolean {
        return this.internalSpoiled;
    }

    /**
     * Creates a new PollResponseEvent from a pure format. Note that the event is *not*
     * parsed here: it will be treated as a literal m.poll.response primary typed event.
     *
     * To validate the response against a poll, call `validateAgainst` after creation.
     * @param wireFormat - The event.
     */
    public constructor(wireFormat: IPartialEvent<PollResponseEventContent>) {
        super(wireFormat);

        const rel = this.wireContent["m.relates_to"];
        if (!REFERENCE_RELATION.matches(rel?.rel_type) || typeof rel?.event_id !== "string") {
            throw new InvalidEventError("Relationship must be a reference to an event");
        }

        this.pollEventId = rel.event_id;
        this.validateAgainst(null);
    }

    /**
     * Validates the poll response using the poll start event as a frame of reference. This
     * is used to determine if the vote is spoiled, whether the answers are valid, etc.
     * @param poll - The poll start event.
     */
    public validateAgainst(poll: PollStartEvent | null): void {
        const response = M_POLL_RESPONSE.findIn<PollResponseSubtype>(this.wireContent);
        if (!Array.isArray(response?.answers)) {
            this.internalSpoiled = true;
            this.internalAnswerIds = [];
            return;
        }

        let answers = response?.answers ?? [];
        if (answers.some((a) => typeof a !== "string") || answers.length === 0) {
            this.internalSpoiled = true;
            this.internalAnswerIds = [];
            return;
        }

        if (poll) {
            if (answers.some((a) => !poll.answers.some((pa) => pa.id === a))) {
                this.internalSpoiled = true;
                this.internalAnswerIds = [];
                return;
            }

            answers = answers.slice(0, poll.maxSelections);
        }

        this.internalAnswerIds = answers;
        this.internalSpoiled = false;
    }

    public isEquivalentTo(primaryEventType: ExtensibleEventType): boolean {
        return isEventTypeSame(primaryEventType, M_POLL_RESPONSE);
    }

    public serialize(): IPartialEvent<object> {
        return {
            type: M_POLL_RESPONSE.name,
            content: {
                "m.relates_to": {
                    rel_type: REFERENCE_RELATION.name,
                    event_id: this.pollEventId,
                },
                [M_POLL_RESPONSE.name]: {
                    answers: this.spoiled ? undefined : this.answerIds,
                },
            },
        };
    }

    /**
     * Creates a new PollResponseEvent from a set of answers. To spoil the vote, pass an empty
     * answers array.
     * @param answers - The user's answers. Should be valid from a poll's answer IDs.
     * @param pollEventId - The poll start event ID.
     * @returns The representative poll response event.
     */
    public static from(answers: string[], pollEventId: string): PollResponseEvent {
        return new PollResponseEvent({
            type: M_POLL_RESPONSE.name,
            content: {
                "m.relates_to": {
                    rel_type: REFERENCE_RELATION.name,
                    event_id: pollEventId,
                },
                [M_POLL_RESPONSE.name]: {
                    answers: answers,
                },
            },
        });
    }
}
