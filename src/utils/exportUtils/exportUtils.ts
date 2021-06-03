import { Room } from 'matrix-js-sdk/src/models/room';
import HTMLExporter from "./HtmlExport";

export enum exportFormats {
    HTML = "HTML",
    JSON = "JSON",
    LOGS = "LOGS",
}

export enum exportOptions {
    TIMELINE = "TIMELINE",
}

const exportConversationalHistory = async (room: Room, format: string, options) => {
    switch (format) {
        case exportFormats.HTML:
            await new HTMLExporter(room).export();
            break;
        case exportFormats.JSON:
            break;
        case exportFormats.LOGS:
            break;
    }
};

export default exportConversationalHistory;
