import { MatrixClientPeg } from "../../MatrixClientPeg";
import { arrayFastClone } from "../arrays";
import { TimelineWindow } from "matrix-js-sdk/src/timeline-window";
import Room from 'matrix-js-sdk/src/models/room';
import HTMLExporter from "./HtmlExport";

export enum exportFormats {
    HTML = "HTML",
    JSON = "JSON",
    LOGS = "LOGS",
}

export enum exportOptions {
    TIMELINE = "TIMELINE",
}

const getTimelineConversation = (room: Room) => {
    if (!room) return;

    const cli = MatrixClientPeg.get();

    const timelineSet = room.getUnfilteredTimelineSet();

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


const exportConversationalHistory = async (room: Room, format: string, options) => {
    const res = getTimelineConversation(room);
    switch (format) {
        case exportFormats.HTML:
            await new HTMLExporter(res, room).export();
            break;
        case exportFormats.JSON:
            break;
        case exportFormats.LOGS:
            break;
    }
};

export default exportConversationalHistory;
