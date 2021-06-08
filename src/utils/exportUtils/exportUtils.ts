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
    START_DATE = "START_DATE",
    LAST_N_MESSAGES = "LAST_N_MESSAGES",
}

const exportConversationalHistory = async (
    room: Room,
    format: string,
    exportType: exportTypes,
    exportTypeMetadata?: number,
) => {
    switch (format) {
        case exportFormats.HTML:
            await new HTMLExporter(room, exportType, exportTypeMetadata).export();
            break;
        case exportFormats.JSON:
            break;
        case exportFormats.LOGS:
            break;
    }
};

export default exportConversationalHistory;
