import { Room } from "matrix-js-sdk/src/models/room";
import HTMLExporter from "./HtmlExport";

export enum exportFormats {
    HTML = "HTML",
    JSON = "JSON",
    LOGS = "LOGS",
}

export enum exportTypes {
    TIMELINE = "TIMELINE",
    BEGINNING = "BEGINNING",
    LAST_N_MESSAGES = "LAST_N_MESSAGES",
}

const exportConversationalHistory = async (
    room: Room,
    format: string,
    exportType: exportTypes,
    numberOfEvents?: number,
) => {
    switch (format) {
        case exportFormats.HTML:
            await new HTMLExporter(room, exportType, numberOfEvents).export();
            break;
        case exportFormats.JSON:
            break;
        case exportFormats.LOGS:
            break;
    }
};

export default exportConversationalHistory;
