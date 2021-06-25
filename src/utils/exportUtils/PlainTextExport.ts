import Exporter from "./Exporter";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { formatFullDateNoDay } from "../../DateUtils";
import { _t } from "../../languageHandler";
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

    public async export() {
        console.info("Starting export process...");
        console.info("Fetching events...");
        const fetchStart = performance.now();
        const res = await this.getRequiredEvents();
        const fetchEnd = performance.now();

        console.log(`Fetched ${res.length} events in ${(fetchEnd - fetchStart)/1000} s`);
        console.info("Creating Output...");

        const text = await this.createOutput(res);

        if (this.files.length) {
            this.addFile("export.txt", new Blob([text]));
            await this.downloadZIP();
        } else {
            const fileName = `matrix-export-${formatFullDateNoDay(new Date())}.txt`;
            await this.downloadPlainText(fileName, text);
        }

        const exportEnd = performance.now();
        console.info(`Export Successful! Exported ${res.length} events in ${(exportEnd - fetchStart)/1000} seconds`);
        window.removeEventListener("onunload", this.abortExport);
        window.removeEventListener("beforeunload", this.onBeforeUnload);
    }
}

