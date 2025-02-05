/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    type RelationType,
    TypedEventEmitter,
    type Relations,
    RelationsEvent,
} from "matrix-js-sdk/src/matrix";

import { type IDestroyable } from "../utils/IDestroyable";

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
