import React from "react"
import streamSaver from "streamsaver";
import JSZip from "jszip";
import Exporter from "./Exporter";
import { decryptFile } from "../DecryptFile";
import { mediaFromContent, mediaFromMxc } from "../../customisations/Media";
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
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { MatrixClient } from "matrix-js-sdk";

export default class HTMLExporter extends Exporter {
    protected zip: JSZip;
    protected avatars: Map<string, boolean>;
    protected permalinkCreator: RoomPermalinkCreator;
    protected matrixClient: MatrixClient;

    constructor(room: Room, exportType: exportTypes, numberOfEvents?: number) {
        super(room, exportType, numberOfEvents);
        this.zip = new JSZip();
        this.avatars = new Map<string, boolean>();
        this.matrixClient = MatrixClientPeg.get();
        this.permalinkCreator = new RoomPermalinkCreator(this.room);
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
        const cli = MatrixClientPeg.get();
        const creator = this.room.currentState.getStateEvents(EventType.RoomCreate, "")?.getSender();
        const creatorName = this.room?.getMember(creator)?.rawDisplayName || creator;
        const exporter = cli.getUserId();
        const exporterName = this.room?.getMember(exporter)?.rawDisplayName;
        const topic = this.room.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent()?.topic
                     || this.room.topic || "";
        const createdText = _t("%(creatorName)s created this room.", {
            creatorName,
        });

        const exportedText = _t(`This is the start of export of <b>%(roomName)s</b>.
         Exported by %(exporterDetails)s at %(exportDate)s. `, {
             exportDate,
             roomName: this.room.name,
             exporterDetails: `<a href="https://matrix.to/#/${exporter}" target="_blank" rel="noopener noreferrer">
                ${exporterName ? `<b>${ exporterName }</b>(${ exporter })` : `<b>${ exporter }</b>`}
             </a>`,
        });

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

    protected async getMediaBlob(event: MatrixEvent) {
        let blob: Blob;
        try {
            const isEncrypted = event.isEncrypted();
            const content = event.getContent();
            const shouldDecrypt = isEncrypted && !content.hasOwnProperty("org.matrix.msc1767.file")
                                  && event.getType() !== "m.sticker";
            if (shouldDecrypt) {
                blob = await decryptFile(content.file);
            } else {
                const media = mediaFromContent(event.getContent());
                const image = await fetch(media.srcHttp);
                blob = await image.blob();
            }
        } catch (err) {
            console.log("Error decrypting media");
        }
        return blob;
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

    protected splitFileName(file: string) {
        const lastDot = file.lastIndexOf('.');
        if (lastDot === -1) return [file, ""];
        const fileName = file.slice(0, lastDot);
        const ext = file.slice(lastDot + 1);
        return [fileName, '.' + ext];
    }

    protected getFilePath(event: MatrixEvent) {
        const mediaType = event.getContent().msgtype;
        let fileDirectory: string;
        switch (mediaType) {
            case "m.image":
                fileDirectory = "images";
                break;
            case "m.video":
                fileDirectory = "videos";
                break;
            case "m.audio":
                fileDirectory = "audio";
                break;
            default:
                fileDirectory = event.getType() === "m.sticker" ? "stickers" : "files";
        }
        const fileDate = formatFullDateNoDay(new Date(event.getTs()));
        const [fileName, fileExt] = this.splitFileName(event.getContent().body);
        return fileDirectory + "/" + fileName + '-' + fileDate + fileExt;
    }


    protected async getEventTile(mxEv: MatrixEvent, continuation: boolean, mediaSrc?: string) {
        const hasAvatar = this.hasAvatar(mxEv);
        if (hasAvatar) await this.saveAvatarIfNeeded(mxEv);

        return <li className="mx_Export_EventWrapper" id={mxEv.getId()}>
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
                    mediaSrc={mediaSrc}
                    avatarSrc={hasAvatar ? `users/${mxEv.sender.userId}` : null}
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
        </li>
    }

    protected async createMessageBody(mxEv: MatrixEvent, joined = false) {
        let eventTile: JSX.Element;
        const attachmentTypes = ["m.sticker", "m.image", "m.file", "m.video", "m.audio"]

        if (mxEv.getType() === attachmentTypes[0] || attachmentTypes.includes(mxEv.getContent().msgtype)) {
            const blob = await this.getMediaBlob(mxEv);
            const filePath = this.getFilePath(mxEv);
            eventTile = await this.getEventTile(mxEv, joined, filePath);
            this.zip.file(filePath, blob);
        } else eventTile = await this.getEventTile(mxEv, joined);

        return renderToStaticMarkup(eventTile);
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

