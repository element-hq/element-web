/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import {
    Filter,
    type EventTimelineSet,
    type IRoomTimelineData,
    type Direction,
    type MatrixEvent,
    MatrixEventEvent,
    type Room,
    RoomEvent,
    type TimelineWindow,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import FilesIcon from "@vector-im/compound-design-tokens/assets/web/icons/files";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import EventIndexPeg from "../../indexing/EventIndexPeg";
import { _t } from "../../languageHandler";
import SearchWarning, { WarningKind } from "../views/elements/SearchWarning";
import BaseCard from "../views/right_panel/BaseCard";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import TimelinePanel from "./TimelinePanel";
import Spinner from "../views/elements/Spinner";
import { Layout } from "../../settings/enums/Layout";
import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import Measured from "../views/elements/Measured";
import EmptyState from "../views/right_panel/EmptyState";
import { ScopedRoomContextProvider } from "../../contexts/ScopedRoomContext.tsx";

interface IProps {
    roomId: string;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
}

interface IState {
    timelineSet: EventTimelineSet | null;
    narrow: boolean;
}

/*
 * Component which shows the filtered file using a TimelinePanel
 */
class FilePanel extends React.Component<IProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    // This is used to track if a decrypted event was a live event and should be
    // added to the timeline.
    private decryptingEvents = new Set<string>();
    public noRoom = false;
    private card = createRef<HTMLDivElement>();

    public state: IState = {
        timelineSet: null,
        narrow: false,
    };

    private onRoomTimeline = (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: IRoomTimelineData,
    ): void => {
        if (room?.roomId !== this.props.roomId) return;
        if (toStartOfTimeline || !data || !data.liveEvent || ev.isRedacted()) return;

        const client = MatrixClientPeg.safeGet();
        client.decryptEventIfNeeded(ev);

        if (ev.isBeingDecrypted()) {
            this.decryptingEvents.add(ev.getId()!);
        } else {
            this.addEncryptedLiveEvent(ev);
        }
    };

    private onEventDecrypted = (ev: MatrixEvent, err?: any): void => {
        if (ev.getRoomId() !== this.props.roomId) return;
        const eventId = ev.getId()!;

        if (!this.decryptingEvents.delete(eventId)) return;
        if (err) return;

        this.addEncryptedLiveEvent(ev);
    };

    public addEncryptedLiveEvent(ev: MatrixEvent): void {
        if (!this.state.timelineSet) return;

        const timeline = this.state.timelineSet.getLiveTimeline();
        if (ev.getType() !== "m.room.message") return;
        if (!["m.file", "m.image", "m.video", "m.audio"].includes(ev.getContent().msgtype!)) {
            return;
        }

        if (!this.state.timelineSet.eventIdToTimeline(ev.getId()!)) {
            this.state.timelineSet.addEventToTimeline(ev, timeline, {
                fromCache: false,
                addToState: false,
                toStartOfTimeline: false,
            });
        }
    }

    public async componentDidMount(): Promise<void> {
        const client = MatrixClientPeg.safeGet();

        await this.updateTimelineSet(this.props.roomId);

        if (!client.isRoomEncrypted(this.props.roomId)) return;

        // The timelineSets filter makes sure that encrypted events that contain
        // URLs never get added to the timeline, even if they are live events.
        // These methods are here to manually listen for such events and add
        // them despite the filter's best efforts.
        //
        // We do this only for encrypted rooms and if an event index exists,
        // this could be made more general in the future or the filter logic
        // could be fixed.
        if (EventIndexPeg.get() !== null) {
            client.on(RoomEvent.Timeline, this.onRoomTimeline);
            client.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        }
    }

    public componentWillUnmount(): void {
        const client = MatrixClientPeg.get();
        if (client === null) return;

        if (!client.isRoomEncrypted(this.props.roomId)) return;

        if (EventIndexPeg.get() !== null) {
            client.removeListener(RoomEvent.Timeline, this.onRoomTimeline);
            client.removeListener(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        }
    }

    public async fetchFileEventsServer(room: Room): Promise<EventTimelineSet> {
        const client = MatrixClientPeg.safeGet();

        const filter = new Filter(client.getSafeUserId());
        filter.setDefinition({
            room: {
                timeline: {
                    contains_url: true,
                    types: ["m.room.message"],
                },
            },
        });

        filter.filterId = await client.getOrCreateFilter("FILTER_FILES_" + client.credentials.userId, filter);
        return room.getOrCreateFilteredTimelineSet(filter);
    }

    private onPaginationRequest = (
        timelineWindow: TimelineWindow,
        direction: Direction,
        limit: number,
    ): Promise<boolean> => {
        const client = MatrixClientPeg.safeGet();
        const eventIndex = EventIndexPeg.get();
        const roomId = this.props.roomId;

        const room = client.getRoom(roomId);

        // We override the pagination request for encrypted rooms so that we ask
        // the event index to fulfill the pagination request. Asking the server
        // to paginate won't ever work since the server can't correctly filter
        // out events containing URLs
        if (room && client.isRoomEncrypted(roomId) && eventIndex !== null) {
            return eventIndex.paginateTimelineWindow(room, timelineWindow, direction, limit);
        } else {
            return timelineWindow.paginate(direction, limit);
        }
    };

    private onMeasurement = (narrow: boolean): void => {
        this.setState({ narrow });
    };

    public async updateTimelineSet(roomId: string): Promise<void> {
        const client = MatrixClientPeg.safeGet();
        const room = client.getRoom(roomId);
        const eventIndex = EventIndexPeg.get();

        this.noRoom = !room;

        if (room) {
            let timelineSet;

            try {
                timelineSet = await this.fetchFileEventsServer(room);

                // If this room is encrypted the file panel won't be populated
                // correctly since the defined filter doesn't support encrypted
                // events and the server can't check if encrypted events contain
                // URLs.
                //
                // This is where our event index comes into place, we ask the
                // event index to populate the timelineSet for us. This call
                // will add 10 events to the live timeline of the set. More can
                // be requested using pagination.
                if (client.isRoomEncrypted(roomId) && eventIndex !== null) {
                    const timeline = timelineSet.getLiveTimeline();
                    await eventIndex.populateFileTimeline(timelineSet, timeline, room, 10);
                }

                this.setState({ timelineSet: timelineSet });
            } catch (error) {
                logger.error("Failed to get or create file panel filter", error);
            }
        } else {
            logger.error("Failed to add filtered timelineSet for FilePanel as no room!");
        }
    }

    public render(): React.ReactNode {
        if (MatrixClientPeg.safeGet().isGuest()) {
            return (
                <BaseCard
                    className="mx_FilePanel mx_RoomView_messageListWrapper"
                    onClose={this.props.onClose}
                    header={_t("right_panel|files_button")}
                >
                    <div className="mx_RoomView_empty">
                        {_t(
                            "file_panel|guest_note",
                            {},
                            {
                                a: (sub) => (
                                    <a href="#/register" key="sub">
                                        {sub}
                                    </a>
                                ),
                            },
                        )}
                    </div>
                </BaseCard>
            );
        } else if (this.noRoom) {
            return (
                <BaseCard
                    className="mx_FilePanel mx_RoomView_messageListWrapper"
                    onClose={this.props.onClose}
                    header={_t("right_panel|files_button")}
                >
                    <div className="mx_RoomView_empty">{_t("file_panel|peek_note")}</div>
                </BaseCard>
            );
        }

        // wrap a TimelinePanel with the jump-to-event bits turned off.

        const emptyState = (
            <EmptyState
                Icon={FilesIcon}
                title={_t("file_panel|empty_heading")}
                description={_t("file_panel|empty_description")}
            />
        );

        const isRoomEncrypted = this.noRoom ? false : MatrixClientPeg.safeGet().isRoomEncrypted(this.props.roomId);

        if (this.state.timelineSet) {
            return (
                <ScopedRoomContextProvider
                    {...this.context}
                    timelineRenderingType={TimelineRenderingType.File}
                    narrow={this.state.narrow}
                >
                    <BaseCard
                        className="mx_FilePanel"
                        onClose={this.props.onClose}
                        withoutScrollContainer
                        ref={this.card}
                        header={_t("right_panel|files_button")}
                    >
                        <Measured sensor={this.card} onMeasurement={this.onMeasurement} />
                        <SearchWarning isRoomEncrypted={isRoomEncrypted} kind={WarningKind.Files} />
                        <TimelinePanel
                            manageReadReceipts={false}
                            manageReadMarkers={false}
                            timelineSet={this.state.timelineSet}
                            showUrlPreview={false}
                            onPaginationRequest={this.onPaginationRequest}
                            resizeNotifier={this.props.resizeNotifier}
                            empty={emptyState}
                            layout={Layout.Group}
                        />
                    </BaseCard>
                </ScopedRoomContextProvider>
            );
        } else {
            return (
                <ScopedRoomContextProvider {...this.context} timelineRenderingType={TimelineRenderingType.File}>
                    <BaseCard
                        className="mx_FilePanel"
                        onClose={this.props.onClose}
                        header={_t("right_panel|files_button")}
                    >
                        <Spinner />
                    </BaseCard>
                </ScopedRoomContextProvider>
            );
        }
    }
}

export default FilePanel;
