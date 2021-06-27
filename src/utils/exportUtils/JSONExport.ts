import Exporter from "./Exporter";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { formatFullDateNoDay, formatFullDateNoDayNoTime } from "../../DateUtils";
import { haveTileForEvent } from "../../components/views/rooms/EventTile";
import { exportTypes } from "./exportUtils";
import { exportOptions } from "./exportUtils";
import { EventType } from "matrix-js-sdk/src/@types/event";


export default class JSONExporter extends Exporter {
    protected totalSize: number;

    constructor(room: Room, exportType: exportTypes, exportOptions: exportOptions) {
        super(room, exportType, exportOptions);
        this.totalSize = 0;
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

    protected indentEachLine(JSONString: string, spaces: number) {
        const indent = ' ';
        const regex = /^(?!\s*$)/gm;
        return JSONString.replace(regex, indent.repeat(spaces));
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
            if (this.cancelled) return this.cleanUp();
            if (!haveTileForEvent(event)) continue;
            content += await this.getJSONString(event);
        }
        return this.wrapJSON(this.indentEachLine(content.slice(0, -2), 2));
    }

    public async export() {
        console.info("Starting export process...");
        console.info("Fetching events...");

        const fetchStart = performance.now();
        const res = await this.getRequiredEvents();
        const fetchEnd = performance.now();

        console.log(`Fetched ${res.length} events in ${(fetchEnd - fetchStart)/1000}s`);

        console.info("Creating output...");
        const text = await this.createOutput(res);

        if (this.files.length) {
            this.addFile("export.json", new Blob([text]));
            await this.downloadZIP();
        } else {
            const fileName = `matrix-export-${formatFullDateNoDay(new Date())}.json`;
            await this.downloadPlainText(fileName, text);
        }

        const exportEnd = performance.now();

        if (this.cancelled) {
            console.info("Export cancelled successfully");
        } else {
            console.info("Export successful!")
            console.log(`Exported ${res.length} events in ${(exportEnd - fetchStart)/1000} seconds`);
        }

        this.cleanUp()
    }
}

