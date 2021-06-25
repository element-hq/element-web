import { Room } from "matrix-js-sdk/src/models/room";
import HTMLExporter from "./HtmlExport";
import JSONExporter from "./JSONExport";
import PlainTextExporter from "./PlainTextExport";

export enum exportFormats {
    HTML = "HTML",
    JSON = "JSON",
    PLAIN_TEXT = "PLAIN_TEXT",
}

export enum exportTypes {
    TIMELINE = "TIMELINE",
    BEGINNING = "BEGINNING",
    START_DATE = "START_DATE",
    LAST_N_MESSAGES = "LAST_N_MESSAGES",
}

export interface exportOptions {
    startDate?: number;
    numberOfMessages?: number;
    attachmentsIncluded: boolean;
    maxSize: number;
}

const exportConversationalHistory = async (
    room: Room,
    format: string,
    exportType: exportTypes,
    exportOptions?: exportOptions,
) => {
    switch (format) {
        case exportFormats.HTML:
            await new HTMLExporter(room, exportType, exportOptions).export();
            break;
        case exportFormats.JSON:
            await new JSONExporter(room, exportType, exportOptions).export();
            break;
        case exportFormats.PLAIN_TEXT:
            await new PlainTextExporter(room, exportType, exportOptions).export();
            break;
    }
};

export default exportConversationalHistory;
