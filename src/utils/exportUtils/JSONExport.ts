import Exporter from "./Exporter";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { formatFullDateNoDay, formatFullDateNoDayNoTime } from "../../DateUtils";
import { haveTileForEvent } from "../../components/views/rooms/EventTile";
import { exportTypes } from "./exportUtils";
import { exportOptions } from "./exportUtils";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { MutableRefObject } from "react";

export default class JSONExporter extends Exporter {
    protected totalSize: number;
    protected messages: any[];

    constructor(
        room: Room,
        exportType: exportTypes,
        exportOptions: exportOptions,
        exportProgressRef: MutableRefObject<HTMLParagraphElement>,
    ) {
        super(room, exportType, exportOptions, exportProgressRef);
        this.totalSize = 0;
        this.messages = [];
    }

    protected createJSONString(): string {
        const exportDate = formatFullDateNoDayNoTime(new Date());
        const creator = this.room.currentState.getStateEvents(EventType.RoomCreate, "")?.getSender();
        const creatorName = this.room?.getMember(creator)?.rawDisplayName || creator;
        const topic = this.room.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent()?.topic || "";
        const exporter = this.client.getUserId();
        const exporterName = this.room?.getMember(exporter)?.rawDisplayName || exporter;
        const jsonObject = {
            room_name: this.room.name,
            room_creator: creatorName,
            topic,
            export_date: exportDate,
            exported_by: exporterName,
            messages: this.messages,
        };
        return JSON.stringify(jsonObject, null, 2);
    }

    protected async getJSONString(mxEv: MatrixEvent) {
        if (this.exportOptions.attachmentsIncluded && this.isAttachment(mxEv)) {
            try {
                const blob = await this.getMediaBlob(mxEv);
                if (this.totalSize + blob.size < this.exportOptions.maxSize) {
                    this.totalSize += blob.size;
                    const filePath = this.getFilePath(mxEv);
                    if (this.totalSize == this.exportOptions.maxSize) {
                        this.exportOptions.attachmentsIncluded = false;
                    }
                    this.addFile(filePath, blob);
                }
            } catch (err) {
                console.log("Error fetching file: " + err);
            }
        }
        const jsonEvent: any = mxEv.toJSON();
        const clearEvent = mxEv.isEncrypted() ? jsonEvent.decrypted : jsonEvent;
        return clearEvent;
    }

    protected async createOutput(events: MatrixEvent[]) {
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            this.updateProgress(`Processing event ${i + 1} out of ${events.length}`, false, true);
            if (this.cancelled) return this.cleanUp();
            if (!haveTileForEvent(event)) continue;
            this.messages.push(await this.getJSONString(event));
        }
        return this.createJSONString();
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
            console.info("Export successful!");
            console.log(`Exported ${res.length} events in ${(exportEnd - fetchStart)/1000} seconds`);
        }

        this.cleanUp();
    }
}

