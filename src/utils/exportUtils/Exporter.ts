import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { exportTypes } from "./exportUtils";
import { exportOptions } from "./exportUtils";

export default abstract class Exporter {
    protected constructor(
        protected room: Room,
        protected exportType: exportTypes,
        protected exportOptions?: exportOptions,
    ) {}

    protected setEventMetadata = (event: MatrixEvent) => {
        const client = MatrixClientPeg.get();
        const roomState = client.getRoom(this.room.roomId).currentState;
        event.sender = roomState.getSentinelMember(
            event.getSender(),
        );
        if (event.getType() === "m.room.member") {
            event.target = roomState.getSentinelMember(
                event.getStateKey(),
            );
        }
        return event;
    }

    protected getLimit = () => {
        let limit: number;
        switch (this.exportType) {
            case exportTypes.LAST_N_MESSAGES:
                limit = this.exportOptions.numberOfMessages;
                break;
            case exportTypes.TIMELINE:
                limit = 40;
                break;
            default:
                limit = Number.MAX_VALUE;
        }
        return limit;
    }

    protected getRequiredEvents = async () : Promise<MatrixEvent[]> => {
        const client = MatrixClientPeg.get();
        const eventMapper = client.getEventMapper();

        let prevToken: string|null = null;
        let limit = this.getLimit();
        let events: MatrixEvent[] = [];

        while (limit) {
            const eventsPerCrawl = Math.min(limit, 1000);
            const res: any = await client.createMessagesRequest(this.room.roomId, prevToken, eventsPerCrawl, "b");

            if (res.chunk.length === 0) break;

            limit -= res.chunk.length;

            const matrixEvents: MatrixEvent[] = res.chunk.map(eventMapper);

            for (const mxEv of matrixEvents) {
                if (this.exportOptions.startDate && mxEv.getTs() < this.exportOptions.startDate) {
                    // Once the last message received is older than the start date, we break out of both the loops
                    limit = 0;
                    break;
                }
                events.push(mxEv);
            }

            prevToken = res.end;
        }
        // Reverse the events so that we preserve the order
        events = events.reverse();

        const decryptionPromises = events
            .filter(event => event.isEncrypted())
            .map(event => {
                return client.decryptEventIfNeeded(event, {
                    isRetry: true,
                    emit: false,
                });
            });

        // Wait for all the events to get decrypted.
        await Promise.all(decryptionPromises);

        for (let i = 0; i < events.length; i++) this.setEventMetadata(events[i]);

        return events;
    }

    abstract export(): Promise<Blob>;
}
