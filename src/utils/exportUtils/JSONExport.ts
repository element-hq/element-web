import streamSaver from "streamsaver";
import Exporter from "./Exporter";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { formatFullDateNoDay, formatFullDateNoDayNoTime } from "../../DateUtils";
import * as ponyfill from "web-streams-polyfill/ponyfill"
import { haveTileForEvent } from "../../components/views/rooms/EventTile";
import { exportTypes } from "./exportUtils";
import { exportOptions } from "./exportUtils";
import zip from "./StreamToZip";
import { EventType } from "../../../../matrix-js-sdk/src/@types/event";


export default class JSONExporter extends Exporter {
    protected totalSize: number;

    constructor(room: Room, exportType: exportTypes, exportOptions: exportOptions) {
        super(room, exportType, exportOptions);
        this.totalSize = 0;
        window.addEventListener("beforeunload", this.onBeforeUnload)
    }

    protected wrapJSON(json: string): string {
        const exportDate = formatFullDateNoDayNoTime(new Date());
        const creator = this.room.currentState.getStateEvents(EventType.RoomCreate, "")?.getSender();
        const creatorName = this.room?.getMember(creator)?.rawDisplayName || creator;
        const topic = this.room.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent()?.topic || "";
        const exporter = this.client.getUserId();
        const exporterName = this.room?.getMember(exporter)?.rawDisplayName || exporter;
        return `{
"room_name": "${this.room.name}",
"room_creator": "${creatorName}",
"topic": "${topic}",
"export_date": "${exportDate}",
"exported_by": "${exporterName}",
"messages": [
${json}
]
}`
    }

    protected indentEachLine(string: string) {
        const indent = ' ';
        const regex = /^(?!\s*$)/gm;
        return string.replace(regex, indent.repeat(1));
    }

    protected onBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        return e.returnValue = "Are you sure you want to exit during this export?";
    }

    protected async getJSONString(mxEv: MatrixEvent) {
        if (this.exportOptions.attachmentsIncluded && this.isAttachment(mxEv)) {
            try {
                const blob = await this.getMediaBlob(mxEv);
                this.totalSize += blob.size;
                const filePath = this.getFilePath(mxEv);
                this.addFile(filePath, blob);
                if (this.totalSize > this.exportOptions.maxSize - 1024 * 1024) {
                    this.exportOptions.attachmentsIncluded = false;
                }
            } catch (err) {
                console.log("Error fetching file: " + err);
            }
        }
        const jsonEvent: any = mxEv.toJSON();
        const clearEvent = mxEv.isEncrypted() ? jsonEvent.decrypted : jsonEvent;
        const jsonString = JSON.stringify(clearEvent, null, 2);
        return jsonString.length > 2 ? jsonString + ",\n" : "";
    }

    protected async createOutput(events: MatrixEvent[]) {
        let content = "";
        for (const event of events) {
            if (!haveTileForEvent(event)) continue;
            content += await this.getJSONString(event);
        }
        return this.wrapJSON(this.indentEachLine(content.slice(0, -2)));
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

        console.info("Writing to the file system...");
        streamSaver.WritableStream = ponyfill.WritableStream

        const fileName = `matrix-export-${formatFullDateNoDay(new Date())}.json`;
        const files = this.files;
        if (files.length) {
            this.addFile("result.json", new Blob([text]));
            const fileStream = streamSaver.createWriteStream(fileName.slice(0, -5) + ".zip");
            const readableZipStream = zip({
                start(ctrl) {
                    for (const file of files) ctrl.enqueue(file);
                    ctrl.close();
                },
            });
            const writer = fileStream.getWriter()
            const reader = readableZipStream.getReader()
            await this.pumpToFileStream(reader, writer);
        } else {
            const fileStream = streamSaver.createWriteStream(fileName);
            const writer = fileStream.getWriter()
            const data = new TextEncoder().encode(text);
            await writer.write(data);
            await writer.close();
        }

        const exportEnd = performance.now();
        console.info(`Export Successful! Exported ${res.length} events in ${(exportEnd - fetchStart)/1000} seconds`);
        window.removeEventListener("beforeunload", this.onBeforeUnload);
    }
}

