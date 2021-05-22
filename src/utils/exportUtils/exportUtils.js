import { MatrixClientPeg } from "../../MatrixClientPeg";
import { arrayFastClone } from "../arrays";
import { TimelineWindow } from "matrix-js-sdk/src/timeline-window";
import exportAsHTML from "./HtmlExport";

export const exportFormats = Object.freeze({
    "HTML": "HTML",
    "JSON": "JSON",
    "LOGS": "LOGS",
});

export const exportOptions = Object.freeze({
    "TIMELINE": "TIMELINE",
});

const getTimelineConversation = (room) => {
    if (!room) return;

    const cli = MatrixClientPeg.get();

    const timelineSet = room.getUnfilteredTimelineSet();

    const timelineWindow = new TimelineWindow(
        cli, timelineSet,
        {windowLimit: Number.MAX_VALUE});

    timelineWindow.load(null, 20);

    const events = timelineWindow.getEvents();

    // Clone and reverse the events so that we preserve the order
    arrayFastClone(events)
        .reverse()
        .forEach(event => {
            cli.decryptEventIfNeeded(event);
        });

    console.log(events);
    return events;
};


const exportConversationalHistory = async (room, format, options) => {
    const res = getTimelineConversation(room);
    switch (format) {
        case exportFormats.HTML:
            await exportAsHTML(res, room);
            break;
        case exportFormats.JSON:
            break;
        case exportFormats.LOGS:
            break;
    }
};

export default exportConversationalHistory;
