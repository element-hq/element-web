import streamSaver from "streamsaver";
import Exporter from "./Exporter";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { formatFullDateNoDay } from "../../DateUtils";
import { _t } from "../../languageHandler";
import * as ponyfill from "web-streams-polyfill/ponyfill"
import { haveTileForEvent } from "../../components/views/rooms/EventTile";
import { exportTypes } from "./exportUtils";
import { exportOptions } from "./exportUtils";
import { textForEvent } from "../../TextForEvent";

export default class PlainTextExporter extends Exporter {
    protected totalSize: number;
    protected mediaOmitText: string;

    constructor(room: Room, exportType: exportTypes, exportOptions: exportOptions) {
        super(room, exportType, exportOptions);
        this.totalSize = 0;
        this.mediaOmitText = !this.exportOptions.attachmentsIncluded
            ? _t("Media omitted")
            : _t("Media omitted - file size limit exceeded");
        window.addEventListener("beforeunload", this.onBeforeUnload)
    }

    protected onBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        return e.returnValue = "Are you sure you want to exit during this export?";
    }

    protected async createOutput(events: MatrixEvent[]) {
        let content = "";
        for (const event of events) {
            if (!haveTileForEvent(event)) continue;
            content += `${new Date(event.getTs()).toLocaleString()} - ${textForEvent(event)}\n`;
        }
        return content;
    }

    public async export() {
        console.info("Starting export process...");
        console.info("Fetching events...");
        const fetchStart = performance.now();
        const res = await this.getRequiredEvents();
        const fetchEnd = performance.now();

        console.log(`Fetched ${res.length} events in ${(fetchEnd - fetchStart)/1000} s`);
        console.info("Creating Output...");

        const text = await this.createOutput(res);

        const filename = `matrix-export-${formatFullDateNoDay(new Date())}.txt`;

        console.info("Writing to a file...");
        //Support for firefox browser
        streamSaver.WritableStream = ponyfill.WritableStream
        //Create a writable stream to the directory
        const fileStream = streamSaver.createWriteStream(filename);
        const writer = fileStream.getWriter();
        const data = new TextEncoder().encode(text);
        await writer.write(data);
        await writer.close();
        const exportEnd = performance.now();
        console.info(`Export Successful! Exported ${res.length} events in ${(exportEnd - fetchStart)/1000} seconds`);
        window.removeEventListener("beforeunload", this.onBeforeUnload);
    }
}

