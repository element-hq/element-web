/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { createRoot } from "react-dom/client";
import { type Room, MatrixEvent, EventType, MsgType } from "matrix-js-sdk/src/matrix";
import { renderToStaticMarkup } from "react-dom/server";
import { logger } from "matrix-js-sdk/src/logger";
import escapeHtml from "escape-html";
import { TooltipProvider } from "@vector-im/compound-web";
import { defer } from "matrix-js-sdk/src/utils";

import Exporter from "./Exporter";
import { mediaFromMxc } from "../../customisations/Media";
import { Layout } from "../../settings/enums/Layout";
import { shouldFormContinuation } from "../../components/structures/MessagePanel";
import { formatFullDateNoDayNoTime, wantsDateSeparator } from "../../DateUtils";
import { RoomPermalinkCreator } from "../permalinks/Permalinks";
import { _t } from "../../languageHandler";
import * as Avatar from "../../Avatar";
import EventTile from "../../components/views/rooms/EventTile";
import DateSeparator from "../../components/views/messages/DateSeparator";
import BaseAvatar from "../../components/views/avatars/BaseAvatar";
import { type ExportType, type IExportOptions } from "./exportUtils";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import getExportCSS from "./exportCSS";
import { textForEvent } from "../../TextForEvent";
import { haveRendererForEvent } from "../../events/EventTileFactory";

import exportJS from "!!raw-loader!./exportJS";

export default class HTMLExporter extends Exporter {
    protected avatars: Map<string, boolean>;
    protected permalinkCreator: RoomPermalinkCreator;
    protected totalSize: number;
    protected mediaOmitText: string;

    public constructor(
        room: Room,
        exportType: ExportType,
        exportOptions: IExportOptions,
        setProgressText: React.Dispatch<React.SetStateAction<string>>,
    ) {
        super(room, exportType, exportOptions, setProgressText);
        this.avatars = new Map<string, boolean>();
        this.permalinkCreator = new RoomPermalinkCreator(this.room);
        this.totalSize = 0;
        this.mediaOmitText = !this.exportOptions.attachmentsIncluded
            ? _t("export_chat|media_omitted")
            : _t("export_chat|media_omitted_file_size");
    }

    protected async getRoomAvatar(): Promise<string> {
        let blob: Blob | undefined = undefined;
        const avatarUrl = Avatar.avatarUrlForRoom(this.room, 32, 32, "crop");
        const avatarPath = "room.png";
        if (avatarUrl) {
            try {
                const image = await fetch(avatarUrl);
                blob = await image.blob();
                this.totalSize += blob.size;
                this.addFile(avatarPath, blob);
            } catch (err) {
                logger.log("Failed to fetch room's avatar" + err);
            }
        }
        const avatar = (
            <BaseAvatar size="32px" name={this.room.name} title={this.room.name} url={blob ? avatarPath : ""} />
        );
        return renderToStaticMarkup(avatar);
    }

    protected async wrapHTML(content: string, currentPage: number, nbPages: number): Promise<string> {
        const roomAvatar = await this.getRoomAvatar();
        const exportDate = formatFullDateNoDayNoTime(new Date());
        const creator = this.room.currentState.getStateEvents(EventType.RoomCreate, "")?.getSender();
        const creatorName = (creator ? this.room.getMember(creator)?.rawDisplayName : creator) || creator;
        const exporter = this.room.client.getSafeUserId();
        const exporterName = this.room.getMember(exporter)?.rawDisplayName;
        const topic = this.room.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent()?.topic || "";

        const safeCreatedText = escapeHtml(
            _t("export_chat|creator_summary", {
                creatorName,
            }),
        );
        const safeExporter = escapeHtml(exporter);
        const safeRoomName = escapeHtml(this.room.name);
        const safeTopic = escapeHtml(topic);
        const safeExportedText = renderToStaticMarkup(
            <p>
                {_t(
                    "export_chat|export_info",
                    {
                        exportDate,
                    },
                    {
                        roomName: () => <strong>{safeRoomName}</strong>,
                        exporterDetails: () => (
                            <a
                                href={`https://matrix.to/#/${encodeURIComponent(exporter)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {exporterName ? (
                                    <>
                                        <strong>{escapeHtml(exporterName)}</strong>I {" (" + safeExporter + ")"}
                                    </>
                                ) : (
                                    <strong>{safeExporter}</strong>
                                )}
                            </a>
                        ),
                    },
                )}
            </p>,
        );

        const safeTopicText = topic ? _t("export_chat|topic", { topic: safeTopic }) : "";
        const previousMessagesLink = renderToStaticMarkup(
            currentPage !== 0 ? (
                <div style={{ textAlign: "center" }}>
                    <a href={`./messages${currentPage === 1 ? "" : currentPage}.html`} style={{ fontWeight: "bold" }}>
                        {_t("export_chat|previous_page")}
                    </a>
                </div>
            ) : (
                <></>
            ),
        );

        const nextMessagesLink = renderToStaticMarkup(
            currentPage < nbPages - 1 ? (
                <div style={{ textAlign: "center", margin: "10px" }}>
                    <a href={"./messages" + (currentPage + 2) + ".html"} style={{ fontWeight: "bold" }}>
                        {_t("export_chat|next_page")}
                    </a>
                </div>
            ) : (
                <></>
            ),
        );

        return `
          <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link href="css/style.css" rel="stylesheet" />
                <script src="js/script.js"></script>
                <title>${_t("export_chat|html_title")}</title>
            </head>
            <body style="height: 100vh;" class="cpd-theme-light">
                <div id="matrixchat" style="height: 100%; overflow: auto">
                    <div class="mx_MatrixChat_wrapper" aria-hidden="false">
                        <div class="mx_MatrixChat">
                        <main class="mx_RoomView">
                            <div class="mx_Flex mx_RoomHeader light-panel">
                                ${roomAvatar}
                                <div class="mx_RoomHeader_infoWrapper">
                                    <div
                                        dir="auto"
                                        class="mx_RoomHeader_info"
                                        title="${safeRoomName}"
                                    >
                                        <span class="mx_RoomHeader_truncated mx_lineClamp">
                                            ${safeRoomName}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            ${previousMessagesLink}
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
                                    "
                                >
                                    <div class="mx_RoomView_messageListWrapper">
                                    <ol
                                        class="mx_RoomView_MessageList"
                                        aria-live="polite"
                                        role="list"
                                    >
                                    ${
                                        currentPage == 0
                                            ? `<div class="mx_NewRoomIntro">
                                            ${roomAvatar}
                                            <h2> ${safeRoomName} </h2>
                                            <p> ${safeCreatedText} <br/><br/> ${safeExportedText} </p>
                                            <br/>
                                            <p> ${safeTopicText} </p>
                                        </div>`
                                            : ""
                                    }
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
                            ${nextMessagesLink}
                        </main>
                        </div>
                    </div>
                </div>
                <div id="snackbar"/>
            </body>
        </html>`;
    }

    protected getAvatarURL(event: MatrixEvent): string | null {
        const member = event.sender;
        const avatarUrl = member?.getMxcAvatarUrl();
        return avatarUrl ? mediaFromMxc(avatarUrl).getThumbnailOfSourceHttp(30, 30, "crop") : null;
    }

    protected async saveAvatarIfNeeded(event: MatrixEvent): Promise<void> {
        const member = event.sender!;
        if (!this.avatars.has(member.userId)) {
            try {
                const avatarUrl = this.getAvatarURL(event);
                this.avatars.set(member.userId, true);
                const image = await fetch(avatarUrl!);
                const blob = await image.blob();
                this.addFile(`users/${member.userId.replace(/:/g, "-")}.png`, blob);
            } catch (err) {
                logger.log("Failed to fetch user's avatar" + err);
            }
        }
    }

    protected getDateSeparator(event: MatrixEvent): string {
        const ts = event.getTs();
        const dateSeparator = (
            <li key={ts}>
                <DateSeparator forExport={true} key={ts} roomId={event.getRoomId()!} ts={ts} />
            </li>
        );
        return renderToStaticMarkup(dateSeparator);
    }

    protected needsDateSeparator(event: MatrixEvent, prevEvent: MatrixEvent | null): boolean {
        if (!prevEvent) return true;
        return wantsDateSeparator(prevEvent.getDate() || undefined, event.getDate() || undefined);
    }

    public getEventTile(mxEv: MatrixEvent, continuation: boolean, ref?: () => void): JSX.Element {
        return (
            <div className="mx_Export_EventWrapper" id={mxEv.getId()}>
                <MatrixClientContext.Provider value={this.room.client}>
                    <TooltipProvider>
                        <EventTile
                            mxEvent={mxEv}
                            continuation={continuation}
                            isRedacted={mxEv.isRedacted()}
                            replacingEventId={mxEv.replacingEventId()}
                            forExport={true}
                            alwaysShowTimestamps={true}
                            showUrlPreview={false}
                            checkUnmounting={() => false}
                            isTwelveHour={false}
                            last={false}
                            lastInSection={false}
                            permalinkCreator={this.permalinkCreator}
                            lastSuccessful={false}
                            isSelectedEvent={false}
                            showReactions={true}
                            layout={Layout.Group}
                            showReadReceipts={false}
                            getRelationsForEvent={this.getRelationsForEvent}
                            ref={ref}
                        />
                    </TooltipProvider>
                </MatrixClientContext.Provider>
            </div>
        );
    }

    protected async getEventTileMarkup(mxEv: MatrixEvent, continuation: boolean, filePath?: string): Promise<string> {
        const avatarUrl = this.getAvatarURL(mxEv);
        const hasAvatar = !!avatarUrl;
        if (hasAvatar) await this.saveAvatarIfNeeded(mxEv);
        // We have to wait for the component to be rendered before we can get the markup
        // so pass a deferred as a ref to the component.
        const deferred = defer<void>();
        const EventTile = this.getEventTile(mxEv, continuation, deferred.resolve);
        let eventTileMarkup: string;

        if (
            mxEv.getContent().msgtype == MsgType.Emote ||
            mxEv.getContent().msgtype == MsgType.Notice ||
            mxEv.getContent().msgtype === MsgType.Text
        ) {
            // to linkify textual events, we'll need lifecycle methods which won't be invoked in renderToString
            // So, we'll have to render the component into a temporary root element
            const tempElement = document.createElement("div");
            const tempRoot = createRoot(tempElement);
            tempRoot.render(EventTile);
            await deferred.promise;
            eventTileMarkup = tempElement.innerHTML;
            tempRoot.unmount();
        } else {
            eventTileMarkup = renderToStaticMarkup(EventTile);
        }

        if (filePath) {
            const mxc = mxEv.getContent().url ?? mxEv.getContent().file?.url;
            eventTileMarkup = eventTileMarkup.split(mxc).join(filePath);
        }
        eventTileMarkup = eventTileMarkup.replace(/<span class="mx_MFileBody_info_icon".*?>.*?<\/span>/, "");
        if (hasAvatar) {
            eventTileMarkup = eventTileMarkup.replace(
                encodeURI(avatarUrl).replace(/&/g, "&amp;"),
                `users/${mxEv.sender!.userId.replace(/:/g, "-")}.png`,
            );
        }
        return eventTileMarkup;
    }

    protected createModifiedEvent(text: string, mxEv: MatrixEvent, italic = true): MatrixEvent {
        const modifiedContent = {
            msgtype: MsgType.Text,
            body: `${text}`,
            format: "org.matrix.custom.html",
            formatted_body: `${text}`,
        };
        if (italic) {
            modifiedContent.formatted_body = "<em>" + modifiedContent.formatted_body + "</em>";
            modifiedContent.body = "*" + modifiedContent.body + "*";
        }
        const modifiedEvent = new MatrixEvent();
        modifiedEvent.event = mxEv.event;
        modifiedEvent.sender = mxEv.sender;
        modifiedEvent.event.type = "m.room.message";
        modifiedEvent.event.content = modifiedContent;
        return modifiedEvent;
    }

    protected async createMessageBody(mxEv: MatrixEvent, joined = false): Promise<string> {
        let eventTile: string;
        try {
            if (this.isAttachment(mxEv)) {
                if (this.exportOptions.attachmentsIncluded) {
                    try {
                        const blob = await this.getMediaBlob(mxEv);
                        if (this.totalSize + blob.size > this.exportOptions.maxSize) {
                            eventTile = await this.getEventTileMarkup(
                                this.createModifiedEvent(this.mediaOmitText, mxEv),
                                joined,
                            );
                        } else {
                            this.totalSize += blob.size;
                            const filePath = this.getFilePath(mxEv);
                            eventTile = await this.getEventTileMarkup(mxEv, joined, filePath);
                            if (this.totalSize == this.exportOptions.maxSize) {
                                this.exportOptions.attachmentsIncluded = false;
                            }
                            this.addFile(filePath, blob);
                        }
                    } catch (e) {
                        logger.log("Error while fetching file" + e);
                        eventTile = await this.getEventTileMarkup(
                            this.createModifiedEvent(_t("export_chat|error_fetching_file"), mxEv),
                            joined,
                        );
                    }
                } else {
                    eventTile = await this.getEventTileMarkup(
                        this.createModifiedEvent(this.mediaOmitText, mxEv),
                        joined,
                    );
                }
            } else {
                eventTile = await this.getEventTileMarkup(mxEv, joined);
            }
        } catch (e) {
            // TODO: Handle callEvent errors
            logger.error(e);
            eventTile = await this.getEventTileMarkup(
                this.createModifiedEvent(textForEvent(mxEv, this.room.client), mxEv, false),
                joined,
            );
        }

        return eventTile;
    }

    protected async createHTML(
        events: MatrixEvent[],
        start: number,
        currentPage: number,
        nbPages: number,
    ): Promise<string> {
        let content = "";
        let prevEvent: MatrixEvent | null = null;
        for (let i = start; i < Math.min(start + 1000, events.length); i++) {
            const event = events[i];
            this.updateProgress(
                _t("export_chat|processing_event_n", {
                    number: i + 1,
                    total: events.length,
                }),
                false,
                true,
            );
            if (this.cancelled) return this.cleanUp();
            if (!haveRendererForEvent(event, this.room.client, false)) continue;

            content += this.needsDateSeparator(event, prevEvent) ? this.getDateSeparator(event) : "";
            const shouldBeJoined =
                !this.needsDateSeparator(event, prevEvent) &&
                shouldFormContinuation(prevEvent, event, this.room.client, false);
            const body = await this.createMessageBody(event, shouldBeJoined);
            this.totalSize += new TextEncoder().encode(body).byteLength;
            content += body;
            prevEvent = event;
        }
        return this.wrapHTML(content, currentPage, nbPages);
    }

    public async export(): Promise<void> {
        this.updateProgress(_t("export_chat|starting_export"));

        const fetchStart = performance.now();
        const res = await this.getRequiredEvents();
        const fetchEnd = performance.now();

        this.updateProgress(
            _t("export_chat|fetched_n_events_in_time", {
                count: res.length,
                seconds: (fetchEnd - fetchStart) / 1000,
            }),
            true,
            false,
        );

        this.updateProgress(_t("export_chat|creating_html"));

        const usedClasses = new Set<string>();
        for (let page = 0; page < res.length / 1000; page++) {
            const html = await this.createHTML(res, page * 1000, page, res.length / 1000);
            const document = new DOMParser().parseFromString(html, "text/html");
            document.querySelectorAll("*").forEach((element) => {
                element.classList.forEach((c) => usedClasses.add(c));
            });
            this.addFile(`messages${page ? page + 1 : ""}.html`, new Blob([html]));
        }

        const exportCSS = await getExportCSS(usedClasses);
        this.addFile("css/style.css", new Blob([exportCSS]));
        this.addFile("js/script.js", new Blob([exportJS]));

        await this.downloadZIP();

        const exportEnd = performance.now();

        if (this.cancelled) {
            logger.info("Export cancelled successfully");
        } else {
            this.updateProgress(_t("export_chat|export_successful"));
            this.updateProgress(
                _t("export_chat|exported_n_events_in_time", {
                    count: res.length,
                    seconds: (exportEnd - fetchStart) / 1000,
                }),
            );
        }

        this.cleanUp();
    }
}
