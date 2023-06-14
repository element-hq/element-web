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

import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastChunkEventType } from "..";

/**
 * Voice broadcast chunk collection.
 * Orders chunks by sequence (if available) or timestamp.
 */
export class VoiceBroadcastChunkEvents {
    private events: MatrixEvent[] = [];

    public getEvents(): MatrixEvent[] {
        return [...this.events];
    }

    public getNext(event: MatrixEvent): MatrixEvent | undefined {
        return this.events[this.events.indexOf(event) + 1];
    }

    public addEvent(event: MatrixEvent): void {
        if (this.addOrReplaceEvent(event)) {
            this.sort();
        }
    }

    public addEvents(events: MatrixEvent[]): void {
        const atLeastOneNew = events.reduce((newSoFar: boolean, event: MatrixEvent): boolean => {
            return this.addOrReplaceEvent(event) || newSoFar;
        }, false);

        if (atLeastOneNew) {
            this.sort();
        }
    }

    public includes(event: MatrixEvent): boolean {
        return !!this.events.find((e) => this.equalByTxnIdOrId(event, e));
    }

    /**
     * @returns {number} Length in milliseconds
     */
    public getLength(): number {
        return this.events.reduce((length: number, event: MatrixEvent) => {
            return length + this.calculateChunkLength(event);
        }, 0);
    }

    public getLengthSeconds(): number {
        return this.getLength() / 1000;
    }

    /**
     * Returns the accumulated length to (excl.) a chunk event.
     */
    public getLengthTo(event: MatrixEvent): number {
        let length = 0;

        for (let i = 0; i < this.events.indexOf(event); i++) {
            length += this.calculateChunkLength(this.events[i]);
        }

        return length;
    }

    public findByTime(time: number): MatrixEvent | null {
        let lengthSoFar = 0;

        for (let i = 0; i < this.events.length; i++) {
            lengthSoFar += this.calculateChunkLength(this.events[i]);

            if (lengthSoFar >= time) {
                return this.events[i];
            }
        }

        return null;
    }

    public isLast(event: MatrixEvent): boolean {
        return this.events.indexOf(event) >= this.events.length - 1;
    }

    public getSequenceForEvent(event: MatrixEvent): number | null {
        const sequence = parseInt(event.getContent()?.[VoiceBroadcastChunkEventType]?.sequence, 10);
        if (!isNaN(sequence)) return sequence;

        if (this.events.includes(event)) return this.events.indexOf(event) + 1;

        return null;
    }

    public getNumberOfEvents(): number {
        return this.events.length;
    }

    private calculateChunkLength(event: MatrixEvent): number {
        return event.getContent()?.["org.matrix.msc1767.audio"]?.duration || event.getContent()?.info?.duration || 0;
    }

    private addOrReplaceEvent = (event: MatrixEvent): boolean => {
        this.events = this.events.filter((e) => !this.equalByTxnIdOrId(event, e));
        this.events.push(event);
        return true;
    };

    private equalByTxnIdOrId(eventA: MatrixEvent, eventB: MatrixEvent): boolean {
        return (
            (eventA.getTxnId() && eventB.getTxnId() && eventA.getTxnId() === eventB.getTxnId()) ||
            eventA.getId() === eventB.getId()
        );
    }

    /**
     * Sort by sequence, if available for all events.
     * Else fall back to timestamp.
     */
    private sort(): void {
        const compareFn = this.allHaveSequence() ? this.compareBySequence : this.compareByTimestamp;
        this.events.sort(compareFn);
    }

    private compareBySequence = (a: MatrixEvent, b: MatrixEvent): number => {
        const aSequence = a.getContent()?.[VoiceBroadcastChunkEventType]?.sequence || 0;
        const bSequence = b.getContent()?.[VoiceBroadcastChunkEventType]?.sequence || 0;
        return aSequence - bSequence;
    };

    private compareByTimestamp = (a: MatrixEvent, b: MatrixEvent): number => {
        return a.getTs() - b.getTs();
    };

    private allHaveSequence(): boolean {
        return !this.events.some((event: MatrixEvent) => {
            const sequence = event.getContent()?.[VoiceBroadcastChunkEventType]?.sequence;
            return parseInt(sequence, 10) !== sequence;
        });
    }
}
