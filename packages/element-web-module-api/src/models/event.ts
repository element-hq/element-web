import type { EventStatus, IEventRelation, Membership } from "matrix-js-sdk";

/**
 * Representation of a Matrix event.
 * @beta
 */
export interface MatrixEvent {
    // Properties provided by the spec
    eventId: string;
    roomId?: string;
    sender: string;
    content: Record<string, unknown>;
    unsigned: Record<string, unknown>;
    type: string;
    stateKey?: string;
    originServerTs: number;
    redacts?: string;

    // Properties provided by the SDK
    membership?: Membership;
    status: EventStatus;
    relation?: IEventRelation | null;
    age?: number;
}
