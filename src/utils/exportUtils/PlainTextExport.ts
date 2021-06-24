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
import zip from "./StreamToZip";


export default class PlainTextExporter extends Exporter {
    protected totalSize: number;
    protected mediaOmitText: string;
    private readonly fileDir: string;

    constructor(room: Room, exportType: exportTypes, exportOptions: exportOptions) {
        super(room, exportType, exportOptions);
        this.totalSize = 0;
        this.fileDir = `matrix-export-${formatFullDateNoDay(new Date())}`;
        this.mediaOmitText = !this.exportOptions.attachmentsIncluded
            ? _t("Media omitted")
            : _t("Media omitted - file size limit exceeded");
        window.addEventListener("beforeunload", this.onBeforeUnload)
    }

    protected onBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        return e.returnValue = "Are you sure you want to exit during this export?";
    }

    protected textForReplyEvent = (ev : MatrixEvent) => {
        const REPLY_REGEX = /> <(.*?)>(.*?)\n\n(.*)/;
        const REPLY_SOURCE_MAX_LENGTH = 32;
        const content = ev.getContent();

        const match = REPLY_REGEX.exec(content.body);

        if (!match) return content.body;

        let rplSource: string;
        const rplName = match[1];
        const rplText = match[3];

        rplSource = match[2].substring(1, REPLY_SOURCE_MAX_LENGTH);
        // Get the first non-blank line from the source.
        const lines = rplSource.split('\n').filter((line) => !/^\s*$/.test(line))
        if (lines.length > 0) {
            // Cut to a maximum length.
            rplSource = lines[0].substring(0, REPLY_SOURCE_MAX_LENGTH);
            // Ellipsis if needed.
            if (lines[0].length > REPLY_SOURCE_MAX_LENGTH) {
                rplSource = rplSource + "...";
            }
            // Wrap in formatting
            rplSource = ` "${rplSource}"`;
        } else {
            // Don't show a source because we couldn't format one.
            rplSource = "";
        }

        return `<${rplName}${rplSource}> ${rplText}`;
    }

    protected _textForEvent = async (mxEv: MatrixEvent) => {
        const senderDisplayName = mxEv.sender && mxEv.sender.name ? mxEv.sender.name : mxEv.getSender();
        if (this.exportOptions.attachmentsIncluded && this.isAttachment(mxEv)) {
            const blob = await this.getMediaBlob(mxEv);
            this.totalSize += blob.size;
            const filePath = this.getFilePath(mxEv);
            this.addFile(filePath, blob);
            if (this.totalSize > this.exportOptions.maxSize - 1024 * 1024) {
                this.exportOptions.attachmentsIncluded = false;
            }
        }
        if (this.isReply(mxEv)) return senderDisplayName + ": " + this.textForReplyEvent(mxEv);
        else return textForEvent(mxEv);
    }

    protected async createOutput(events: MatrixEvent[]) {
        let content = "";
        for (const event of events) {
            if (!haveTileForEvent(event)) continue;
            const textForEvent = await this._textForEvent(event);
            content += textForEvent && `${new Date(event.getTs()).toLocaleString()} - ${textForEvent}\n`;
        }
        return content;
    }

    protected getFileName = () => {
        if (this.exportOptions.attachmentsIncluded) {
            return `${this.room.name}.txt`;
        } else return `${this.fileDir}.txt`
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

        const files = this.files;
        if (files.length) {
            this.addFile(this.getFileName(), new Blob([text]));
            const fileStream = streamSaver.createWriteStream(`${this.fileDir}.zip`);
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
            const fileStream = streamSaver.createWriteStream(`${this.fileDir}.txt`);
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

