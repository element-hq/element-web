import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { TimelineWindow } from "matrix-js-sdk/src/timeline-window";
import { arrayFastClone } from "../arrays";
import { exportTypes } from "./exportUtils";

export default abstract class Exporter {
    protected constructor(protected room: Room, protected exportType: exportTypes, protected numberOfEvents?: number) {}

    protected getTimelineConversation = (): MatrixEvent[] => {
        if (!this.room) return;

        const cli = MatrixClientPeg.get();

        const timelineSet = this.room.getUnfilteredTimelineSet();

        const timelineWindow = new TimelineWindow(
            cli, timelineSet,
            {windowLimit: Number.MAX_VALUE});

        timelineWindow.load(null, 30);

        const events: MatrixEvent[] = timelineWindow.getEvents();

        // Clone and reverse the events so that we preserve the order
        arrayFastClone(events)
            .reverse()
            .forEach(async (event) => {
                await cli.decryptEventIfNeeded(event);
            });

        return events;
    };

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

    protected getRequiredEvents = async () : Promise<MatrixEvent[]> => {
        const client = MatrixClientPeg.get();
        const eventMapper = client.getEventMapper();

        let prevToken: string|null = null;
        let limit = this.numberOfEvents || Number.MAX_VALUE;
        let events: MatrixEvent[] = [];

        while (limit) {
            const eventsPerCrawl = Math.min(limit, 100);
            const res: any = await client.createMessagesRequest(this.room.roomId, prevToken, eventsPerCrawl, "b");

            if (res.chunk.length === 0) break;

            limit -= eventsPerCrawl;

            const matrixEvents: MatrixEvent[] = res.chunk.map(eventMapper);

            matrixEvents.forEach(mxEv => events.push(mxEv));

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
