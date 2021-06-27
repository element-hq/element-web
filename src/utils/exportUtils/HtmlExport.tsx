import React from "react"
import Exporter from "./Exporter";
import { mediaFromMxc } from "../../customisations/Media";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { renderToStaticMarkup } from 'react-dom/server'
import { Layout } from "../../settings/Layout";
import { shouldFormContinuation } from "../../components/structures/MessagePanel";
import { formatFullDateNoDayNoTime, wantsDateSeparator } from "../../DateUtils";
import { RoomPermalinkCreator } from "../permalinks/Permalinks";
import { _t } from "../../languageHandler";
import { EventType } from "matrix-js-sdk/src/@types/event";
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

export default class HTMLExporter extends Exporter {
    protected avatars: Map<string, boolean>;
    protected permalinkCreator: RoomPermalinkCreator;
    protected totalSize: number;
    protected mediaOmitText: string;

    constructor(room: Room, exportType: exportTypes, exportOptions: exportOptions) {
        super(room, exportType, exportOptions);
        this.avatars = new Map<string, boolean>();
        this.permalinkCreator = new RoomPermalinkCreator(this.room);
        this.totalSize = 0;
        this.mediaOmitText = !this.exportOptions.attachmentsIncluded
            ? _t("Media omitted")
            : _t("Media omitted - file size limit exceeded");
    }

    protected async getRoomAvatar() {
        let blob: Blob;
        const avatarUrl = Avatar.avatarUrlForRoom(this.room, 32, 32, "crop");
        const avatarPath = "room.png";
        if (avatarUrl) {
            const image = await fetch(avatarUrl);
            blob = await image.blob();
            this.totalSize += blob.size;
            this.addFile(avatarPath, blob);
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
        const exporter = this.client.getUserId();
        const exporterName = this.room?.getMember(exporter)?.rawDisplayName;
        const topic = this.room.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent()?.topic || "";
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

    protected getAvatarURL(event: MatrixEvent): string {
        const member = event.sender;
        return (
            member.getMxcAvatarUrl() &&
            mediaFromMxc(member.getMxcAvatarUrl()).getThumbnailOfSourceHttp(
                30,
                30,
                "crop",
            )
        );
    }

    protected async saveAvatarIfNeeded(event: MatrixEvent) {
        const member = event.sender;
        if (!this.avatars.has(member.userId)) {
            const avatarUrl = this.getAvatarURL(event);
            this.avatars.set(member.userId, true);
            const image = await fetch(avatarUrl);
            const blob = await image.blob();
            this.addFile(`users/${member.userId.replace(/:/g, '-')}.png`, blob);
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
        const hasAvatar = !!this.getAvatarURL(mxEv);
        if (hasAvatar) await this.saveAvatarIfNeeded(mxEv);

        const eventTile = <div className="mx_Export_EventWrapper" id={mxEv.getId()}>
            <MatrixClientContext.Provider value = {this.client}>
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
            eventTileMarkup = eventTileMarkup.replace(
                encodeURI(this.getAvatarURL(mxEv)).replace(/&/g, '&amp;'),
                `users/${mxEv.sender.userId.replace(/:/g, "-")}.png`,
            );
        }
        return eventTileMarkup;
    }

    protected createModifiedEvent(text: string, mxEv: MatrixEvent) {
        const modifiedContent = {
            msgtype: "m.text",
            body: `*${text}*`,
            format: "org.matrix.custom.html",
            formatted_body: `<em>${text}</em>`,
        }
        const modifiedEvent = new MatrixEvent();
        modifiedEvent.event = mxEv.event;
        modifiedEvent.sender = mxEv.sender;
        modifiedEvent.event.type = "m.room.message";
        modifiedEvent.event.content = modifiedContent;
        return modifiedEvent;
    }

    protected async createMessageBody(mxEv: MatrixEvent, joined = false) {
        let eventTile: string;

        if (this.isAttachment(mxEv)) {
            if (this.exportOptions.attachmentsIncluded) {
                try {
                    const blob = await this.getMediaBlob(mxEv);
                    this.totalSize += blob.size;
                    const filePath = this.getFilePath(mxEv);
                    eventTile = await this.getEventTile(mxEv, joined, filePath);
                    if (this.totalSize > this.exportOptions.maxSize - 1024 * 512) {
                        this.exportOptions.attachmentsIncluded = false;
                    }
                    this.addFile(filePath, blob);
                } catch (e) {
                    console.log("Error while fetching file");
                    eventTile = await this.getEventTile(
                        this.createModifiedEvent(_t("Error fetching file"), mxEv),
                        joined,
                    );
                }
            } else {
                eventTile = await this.getEventTile(this.createModifiedEvent(this.mediaOmitText, mxEv), joined);
            }
        } else eventTile = await this.getEventTile(mxEv, joined);

        return eventTile;
    }

    protected async createHTML(events: MatrixEvent[]) {
        let content = "";
        let prevEvent = null;
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            if (this.cancelled) return this.cleanUp();
            if (!haveTileForEvent(event)) continue;

            content += this._wantsDateSeparator(event, prevEvent) ? this.getDateSeparator(event) : "";
            const shouldBeJoined = !this._wantsDateSeparator(event, prevEvent)
                                       && shouldFormContinuation(prevEvent, event);
            const body = await this.createMessageBody(event, shouldBeJoined);
            this.totalSize += Buffer.byteLength(body);
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

        console.log(`Fetched ${res.length} events in ${(fetchEnd - fetchStart)/1000}s`);

        console.info("Creating HTML...");
        const html = await this.createHTML(res);

        this.addFile("index.html", new Blob([html]));
        this.addFile("css/style.css", new Blob([exportCSS]));
        this.addFile("js/script.js", new Blob([exportJS]));

        for (const iconName in exportIcons) {
            this.addFile(`icons/${iconName}`, new Blob([exportIcons[iconName]]));
        }

        await this.downloadZIP();

        const exportEnd = performance.now();

        if (this.cancelled) {
            console.info("Export cancelled successfully");
        } else {
            console.info("Export successful!")
            console.log(`Exported ${res.length} events in ${(exportEnd - fetchStart)/1000} seconds`);
        }

        this.cleanUp();
    }
}

