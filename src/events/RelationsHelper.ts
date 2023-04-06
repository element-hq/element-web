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

import { MatrixClient, MatrixEvent, MatrixEventEvent, RelationType } from "matrix-js-sdk/src/matrix";
import { Relations, RelationsEvent } from "matrix-js-sdk/src/models/relations";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import { IDestroyable } from "../utils/IDestroyable";

export enum RelationsHelperEvent {
    Add = "add",
}

interface EventMap {
    [RelationsHelperEvent.Add]: (event: MatrixEvent) => void;
}

/**
 * Helper class that manages a specific event type relation for an event.
 * Just create an instance and listen for new events for that relation.
 * Optionally receive the current events by calling emitCurrent().
 * Clean up everything by calling destroy().
 */
export class RelationsHelper extends TypedEventEmitter<RelationsHelperEvent, EventMap> implements IDestroyable {
    private relations?: Relations;
    private eventId: string;
    private roomId: string;

    public constructor(
        private event: MatrixEvent,
        private relationType: RelationType,
        private relationEventType: string,
        private client: MatrixClient,
    ) {
        super();

        const eventId = event.getId();

        if (!eventId) {
            throw new Error("unable to create RelationsHelper: missing event ID");
        }

        const roomId = event.getRoomId();

        if (!roomId) {
            throw new Error("unable to create RelationsHelper: missing room ID");
        }

        this.eventId = eventId;
        this.roomId = roomId;
        this.setUpRelations();
    }

    private setUpRelations = (): void => {
        this.setRelations();

        if (this.relations) {
            this.relations.on(RelationsEvent.Add, this.onRelationsAdd);
        } else {
            this.event.once(MatrixEventEvent.RelationsCreated, this.onRelationsCreated);
        }
    };

    private onRelationsCreated = (): void => {
        this.setRelations();

        if (this.relations) {
            this.relations.on(RelationsEvent.Add, this.onRelationsAdd);
            this.emitCurrent();
        } else {
            this.event.once(MatrixEventEvent.RelationsCreated, this.onRelationsCreated);
        }
    };

    private setRelations(): void {
        const room = this.client.getRoom(this.event.getRoomId());
        this.relations = room
            ?.getUnfilteredTimelineSet()
            ?.relations?.getChildEventsForEvent(this.eventId, this.relationType, this.relationEventType);
    }

    private onRelationsAdd = (event: MatrixEvent): void => {
        this.emit(RelationsHelperEvent.Add, event);
    };

    public emitCurrent(): void {
        this.relations?.getRelations()?.forEach((e) => this.emit(RelationsHelperEvent.Add, e));
    }

    public getCurrent(): MatrixEvent[] {
        return this.relations?.getRelations() || [];
    }

    /**
     * Fetches all related events from the server and emits them.
     */
    public async emitFetchCurrent(): Promise<void> {
        let nextBatch: string | undefined = undefined;

        do {
            const response = await this.client.relations(
                this.roomId,
                this.eventId,
                this.relationType,
                this.relationEventType,
                {
                    from: nextBatch,
                    limit: 50,
                },
            );
            nextBatch = response?.nextBatch ?? undefined;
            response?.events.forEach((e) => this.emit(RelationsHelperEvent.Add, e));
        } while (nextBatch);
    }

    public destroy(): void {
        this.removeAllListeners();
        this.event.off(MatrixEventEvent.RelationsCreated, this.onRelationsCreated);

        if (this.relations) {
            this.relations.off(RelationsEvent.Add, this.onRelationsAdd);
        }
    }
}
