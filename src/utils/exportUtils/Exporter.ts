import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { TimelineWindow } from "matrix-js-sdk/src/timeline-window";
import { arrayFastClone } from "../arrays";

export default abstract class Exporter {
    constructor(protected room: Room) {}

    protected getTimelineConversation = () : MatrixEvent[] => {
        if (!this.room) return;

        const cli = MatrixClientPeg.get();

        const timelineSet = this.room.getUnfilteredTimelineSet();

        const timelineWindow = new TimelineWindow(
            cli, timelineSet,
            {windowLimit: Number.MAX_VALUE});

        timelineWindow.load(null, 30);

        const events = timelineWindow.getEvents();

        // Clone and reverse the events so that we preserve the order
        arrayFastClone(events)
            .reverse()
            .forEach(event => {
                cli.decryptEventIfNeeded(event);
            });

        return events;
    };

    abstract export(): Promise<Blob>;
}
