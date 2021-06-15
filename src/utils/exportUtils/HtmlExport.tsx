import React from "react"
import streamSaver from "streamsaver";
import JSZip from "jszip";
import Exporter from "./Exporter";
import { mediaFromMxc } from "../../customisations/Media";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { renderToStaticMarkup } from 'react-dom/server'
import { Layout } from "../../settings/Layout";
import { shouldFormContinuation } from "../../components/structures/MessagePanel";
import { formatFullDateNoDay, formatFullDateNoDayNoTime, wantsDateSeparator } from "../../DateUtils";
import { RoomPermalinkCreator } from "../permalinks/Permalinks";
import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { EventType } from "matrix-js-sdk/src/@types/event";
import * as ponyfill from "web-streams-polyfill/ponyfill"
import * as Avatar from "../../Avatar";
import EventTile, { haveTileForEvent } from "../../components/views/rooms/EventTile";
import DateSeparator from "../../components/views/messages/DateSeparator";
import BaseAvatar from "../../components/views/avatars/BaseAvatar";
import exportCSS from "./exportCSS";
import exportJS from "./exportJS";
import exportIcons from "./exportIcons";
import { exportTypes } from "./exportUtils";
import { exportOptions } from "./exportUtils";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { MatrixClient } from "matrix-js-sdk";

export default class HTMLExporter extends Exporter {
    protected zip: JSZip;
    protected avatars: Map<string, boolean>;
    protected permalinkCreator: RoomPermalinkCreator;
    protected matrixClient: MatrixClient;
    protected totalSize: number;
    protected mediaOmitText: string;

    constructor(room: Room, exportType: exportTypes, exportOptions: exportOptions) {
        super(room, exportType, exportOptions);
        this.zip = new JSZip();
        this.avatars = new Map<string, boolean>();
        this.matrixClient = MatrixClientPeg.get();
        this.permalinkCreator = new RoomPermalinkCreator(this.room);
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

    protected async getRoomAvatar() {
        let blob: Blob;
        const avatarUrl = Avatar.avatarUrlForRoom(this.room, 32, 32, "crop");
        const avatarPath = "room.png";
        if (avatarUrl) {
            const image = await fetch(avatarUrl);
            blob = await image.blob();
            this.zip.file(avatarPath, blob);
        }
        const avatar = (
            <BaseAvatar
                width={32}
                height={32}
                name={this.room.name}
                title={this.room.name}
                url={blob ? avatarPath : null}
                resizeMethod={"crop"}
            />
        );
        return renderToStaticMarkup(avatar);
    }

    protected async wrapHTML(content: string) {
        const roomAvatar = await this.getRoomAvatar();
        const exportDate = formatFullDateNoDayNoTime(new Date());
        const creator = this.room.currentState.getStateEvents(EventType.RoomCreate, "")?.getSender();
        const creatorName = this.room?.getMember(creator)?.rawDisplayName || creator;
        const exporter = this.matrixClient.getUserId();
        const exporterName = this.room?.getMember(exporter)?.rawDisplayName;
        const topic = this.room.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent()?.topic
                     || this.room.topic || "";
        const createdText = _t("%(creatorName)s created this room.", {
            creatorName,
        });

        const exportedText = renderToStaticMarkup(
            <p>
                {_t(
                    "This is the start of export of <roomName/>. Exported by <exporterDetails/> at %(exportDate)s.",
                    {
                        exportDate,
                    },
                    {
                        roomName: () => <b>{this.room.name}</b>,
                        exporterDetails: () => (
                            <a
                                href={`https://matrix.to/#/${exporter}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {exporterName ? (
                                    <>
                                        <b>{exporterName}</b>
                                        {exporter}
                                    </>
                                ) : (
                                    <b>{exporter}</b>
                                )}
                            </a>
                        ),
                    },
                )}
            </p>,
        );

        const topicText = topic ? _t("Topic: %(topic)s", { topic }) : "";

        return `
          <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link href="css/style.css" rel="stylesheet" />
                <script src="js/script.js"></script>
                <title>Exported Data</title>
            </head>
            <body style="height: 100vh;">
                <section
                id="matrixchat"
                style="height: 100%; overflow: auto"
                class="notranslate"
                >
                <div class="mx_MatrixChat_wrapper" aria-hidden="false">
                    <div class="mx_MatrixChat">
                    <main class="mx_RoomView">
                        <div class="mx_RoomHeader light-panel">
                        <div class="mx_RoomHeader_wrapper" aria-owns="mx_RightPanel">
                            <div class="mx_RoomHeader_avatar">
                            <div class="mx_DecoratedRoomAvatar">
                               ${roomAvatar}
                            </div>
                            </div>
                            <div class="mx_RoomHeader_name">
                            <div
                                dir="auto"
                                class="mx_RoomHeader_nametext"
                                title="${this.room.name}"
                            >
                                ${this.room.name}
                            </div>
                            </div>
                            <div class="mx_RoomHeader_topic" dir="auto"> ${topic} </div>
                        </div>
                        </div>
                        <div class="mx_MainSplit">
                        <div class="mx_RoomView_body">
                            <div
                            class="mx_RoomView_timeline mx_RoomView_timeline_rr_enabled"
                            >
                            <div
                                class="
                                mx_AutoHideScrollbar
                                mx_ScrollPanel
                                mx_RoomView_messagePanel
                                mx_GroupLayout
                                "
                            >
                                <div class="mx_RoomView_messageListWrapper">
                                <ol
                                    class="mx_RoomView_MessageList"
                                    aria-live="polite"
                                    role="list"
                                >
                                <div class="mx_NewRoomIntro">
                                    ${roomAvatar}
                                    <h2> ${this.room.name} </h2>
                                    <p> ${createdText} <br/><br/> ${exportedText} </p>
                                    <br/>
                                    <p> ${topicText} </p>
                                </div>
                                ${content}
                                </ol>
                                </div>
                            </div>
                            </div>
                            <div class="mx_RoomView_statusArea">
                            <div class="mx_RoomView_statusAreaBox">
                                <div class="mx_RoomView_statusAreaBox_line"></div>
                            </div>
                            </div>
                        </div>
                        </div>
                    </main>
                    </div>
                </div>
                </section>
                <div id="snackbar"/>
            </body>
        </html>`
    }

    protected hasAvatar(event: MatrixEvent): boolean {
        const member = event.sender;
        return !!member.getMxcAvatarUrl();
    }

    protected async saveAvatarIfNeeded(event: MatrixEvent) {
        const member = event.sender;
        const avatarUrl = mediaFromMxc(member.getMxcAvatarUrl()).getThumbnailOfSourceHttp(30, 30, "crop");
        if (!this.avatars.has(member.userId)) {
            this.avatars.set(member.userId, true);
            const image = await fetch(avatarUrl);
            const blob = await image.blob();
            this.zip.file(`users/${member.userId}`, blob);
        }
    }

    protected getDateSeparator(event: MatrixEvent) {
        const ts = event.getTs();
        const dateSeparator = <li key={ts}><DateSeparator forExport={true} key={ts} ts={ts} /></li>;
        return renderToStaticMarkup(dateSeparator);
    }

    protected _wantsDateSeparator(event: MatrixEvent, prevEvent: MatrixEvent) {
        if (prevEvent == null) return true;
        return wantsDateSeparator(prevEvent.getDate(), event.getDate());
    }

    protected async getEventTile(mxEv: MatrixEvent, continuation: boolean, filePath?: string) {
        const hasAvatar = this.hasAvatar(mxEv);
        if (hasAvatar) await this.saveAvatarIfNeeded(mxEv);

        const eventTile = <div className="mx_Export_EventWrapper" id={mxEv.getId()}>
            <MatrixClientContext.Provider value = {this.matrixClient}>
                <EventTile
                    mxEvent={mxEv}
                    continuation={continuation}
                    isRedacted={mxEv.isRedacted()}
                    replacingEventId={mxEv.replacingEventId()}
                    forExport={true}
                    readReceipts={null}
                    readReceiptMap={null}
                    showUrlPreview={false}
                    checkUnmounting={() => false}
                    isTwelveHour={false}
                    last={false}
                    lastInSection={false}
                    permalinkCreator={this.permalinkCreator}
                    lastSuccessful={false}
                    isSelectedEvent={false}
                    getRelationsForEvent={null}
                    showReactions={false}
                    layout={Layout.Group}
                    enableFlair={false}
                    showReadReceipts={false}
                />
            </MatrixClientContext.Provider>
        </div>
        let eventTileMarkup = renderToStaticMarkup(eventTile);
        if (filePath) eventTileMarkup = eventTileMarkup.replace(/(src=|href=)"forExport"/g, `$1"${filePath}"`);
        if (hasAvatar) {
            eventTileMarkup = eventTileMarkup.replace(/src="AvatarForExport"/g, `src="users/${mxEv.sender.userId}"`);
        }
        return eventTileMarkup;
    }

    protected async createMessageBody(mxEv: MatrixEvent, joined = false) {
        let eventTile: string;

        if (this.isAttachment(mxEv)) {
            if (this.exportOptions.attachmentsIncluded) {
                const blob = await this.getMediaBlob(mxEv);
                this.totalSize += blob.size;
                const filePath = this.getFilePath(mxEv);
                eventTile = await this.getEventTile(mxEv, joined, filePath);
                if (this.totalSize > this.exportOptions.maxSize - 1024 * 1024) {
                    this.exportOptions.attachmentsIncluded = false;
                }
                this.zip.file(filePath, blob);
            } else {
                const modifiedContent = {
                    msgtype: "m.text",
                    body: `**${this.mediaOmitText}**`,
                    format: "org.matrix.custom.html",
                    formatted_body: `<strong>${this.mediaOmitText}</strong>`,
                }
                if (mxEv.isEncrypted()) {
                    mxEv._clearEvent.content = modifiedContent;
                    mxEv._clearEvent.type = "m.room.message";
                } else {
                    mxEv.event.content = modifiedContent;
                    mxEv.event.type = "m.room.message";
                }
                eventTile = await this.getEventTile(mxEv, joined);
            }
        } else eventTile = await this.getEventTile(mxEv, joined);

        return eventTile;
    }

    protected async createHTML(events: MatrixEvent[]) {
        let content = "";
        let prevEvent = null;
        for (const event of events) {
            if (!haveTileForEvent(event)) continue;

            content += this._wantsDateSeparator(event, prevEvent) ? this.getDateSeparator(event) : "";
            const shouldBeJoined = !this._wantsDateSeparator(event, prevEvent)
                                       && shouldFormContinuation(prevEvent, event);
            const body = await this.createMessageBody(event, shouldBeJoined);

            content += body;
            prevEvent = event;
        }
        return await this.wrapHTML(content);
    }

    public async export() {
        console.info("Starting export process...");
        console.info("Fetching events...");
        const fetchStart = performance.now();
        const res = await this.getRequiredEvents();
        const fetchEnd = performance.now();

        console.log(`Fetched ${res.length} events in ${(fetchEnd - fetchStart)/1000} s`);
        console.info("Creating HTML...");

        const html = await this.createHTML(res);

        this.zip.file("index.html", html);
        this.zip.file("css/style.css", exportCSS);
        this.zip.file("js/script.js", exportJS);


        for (const iconName in exportIcons) {
            this.zip.file(`icons/${iconName}`, exportIcons[iconName]);
        }

        const filename = `matrix-export-${formatFullDateNoDay(new Date())}.zip`;

        console.info("HTML creation successful!");
        console.info("Generating a ZIP...");
        //Generate the zip file asynchronously
        const blob = await this.zip.generateAsync({ type: "blob" });

        console.log("ZIP generated successfully");
        console.info("Writing to file system...")
        //Support for firefox browser
        streamSaver.WritableStream = ponyfill.WritableStream
        //Create a writable stream to the directory
        const fileStream = streamSaver.createWriteStream(filename, { size: blob.size });
        const writer = fileStream.getWriter();

        // Here we chunk the blob into pieces of 10 MB, the size might be dynamically generated.
        // This can be used to keep track of the progress
        const sliceSize = 10 * 1e6;
        for (let fPointer = 0; fPointer < blob.size; fPointer += sliceSize) {
            const blobPiece = blob.slice(fPointer, fPointer + sliceSize);
            const reader = new FileReader();

            const waiter = new Promise<void>((resolve) => {
                reader.onloadend = evt => {
                    const arrayBufferNew: any = evt.target.result;
                    const uint8ArrayNew = new Uint8Array(arrayBufferNew);
                    writer.write(uint8ArrayNew);
                    resolve();
                };
                reader.readAsArrayBuffer(blobPiece);
            });
            await waiter;
        }
        await writer.close();
        const exportEnd = performance.now();
        console.info(`Export Successful! Exported ${res.length} events in ${(exportEnd - fetchStart)/1000} seconds`);
        window.removeEventListener("beforeunload", this.onBeforeUnload);
        return blob;
    }
}

