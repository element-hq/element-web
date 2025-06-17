/**
 * Representation of a Matrix event.
 * @beta
 */
export interface MatrixEvent {
    eventId: string;
    roomId?: string;
    sender: string;
    content: Record<string, unknown>;
    unsigned: Record<string, unknown>;
    type: string;
    stateKey?: string;
    originServerTs: number;
    redacts?: string;
    age?: number;
}
