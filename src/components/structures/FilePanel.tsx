/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import {
    type MatrixEvent,
    type Room,
    EventTimeline,
    MatrixEventEvent,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import FilesIcon from "@vector-im/compound-design-tokens/assets/web/icons/files";
import { Form, Search } from "@vector-im/compound-web";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import EventIndexPeg from "../../indexing/EventIndexPeg";
import { _t, getUserLanguage } from "../../languageHandler";
import SearchWarning, { WarningKind } from "../views/elements/SearchWarning";
import BaseCard from "../views/right_panel/BaseCard";
import Spinner from "../views/elements/Spinner";
import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import Measured from "../views/elements/Measured";
import EmptyState from "../views/right_panel/EmptyState";
import { ScopedRoomContextProvider } from "../../contexts/ScopedRoomContext.tsx";
import ScrollPanel from "./ScrollPanel";
import { FilterTabGroup } from "../views/elements/FilterTabGroup";
import SearchResultTile from "../views/rooms/SearchResultTile";
import TimelineSeparator from "../views/messages/TimelineSeparator";
import { formatFullDateNoDayNoTime } from "../../DateUtils";

interface IProps {
    roomId: string;
    onClose: () => void;
}

interface IState {
    narrow: boolean;
    events: MatrixEvent[];
    cursor?: string;
    activeTab: FilePanelTab;
    searchTerm: string;
    loading: boolean;
    exhausted: boolean;
    backfillExhausted: boolean;
}

/*
 * Component which shows the room's files and media list.
 */
class FilePanel extends React.Component<IProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    // This is used to track if a decrypted event was a live event and should be
    // added to the timeline.
    private decryptingEvents = new Set<string>();
    private card = createRef<HTMLDivElement>();

    public state: IState = {
        narrow: false,
        events: [],
        cursor: undefined,
        activeTab: FilePanelTab.Files,
        searchTerm: "",
        loading: true,
        exhausted: false,
        backfillExhausted: false,
    };

    private onRoomTimeline = (
        ev: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        removed: boolean,
        data: any,
    ): void => {
        if (room?.roomId !== this.props.roomId) return;
        if (toStartOfTimeline || !data || !data.liveEvent || ev.isRedacted()) return;

        const client = MatrixClientPeg.safeGet();
        client.decryptEventIfNeeded(ev);

        if (ev.isBeingDecrypted()) {
            this.decryptingEvents.add(ev.getId()!);
        } else {
            this.addEncryptedLiveEventToList(ev);
        }
    };

    private onEventDecrypted = (ev: MatrixEvent, err?: any): void => {
        if (ev.getRoomId() !== this.props.roomId) return;
        const eventId = ev.getId()!;

        if (!this.decryptingEvents.delete(eventId)) return;
        if (err) return;

        this.addEncryptedLiveEventToList(ev);
    };

    private addEncryptedLiveEventToList(ev: MatrixEvent): void {
        if (ev.getType() !== "m.room.message") return;
        const msgtype = ev.getContent().msgtype;
        if (typeof msgtype !== "string" || !FILE_EVENT_MSGTYPES.has(msgtype)) return;
        const eventId = ev.getId();
        if (!eventId) return;

        this.setState((prev) => {
            if (prev.events.some((e) => e.getId() === eventId)) return null;
            return { ...prev, events: [ev, ...prev.events] };
        });
    }

    // 保持向后兼容：旧实现/单测仍会直接调用该方法。
    public addEncryptedLiveEvent(ev: MatrixEvent): void {
        this.addEncryptedLiveEventToList(ev);
    }

    private async loadMoreFileEvents(): Promise<boolean> {
        if (this.state.loading || this.state.exhausted) return false;

        const client = MatrixClientPeg.safeGet();
        const room = client.getRoom(this.props.roomId);
        const eventIndex = EventIndexPeg.get();

        if (!room || !eventIndex) {
            this.setState({ exhausted: true });
            return false;
        }

        this.setState({ loading: true });

        try {
            let backfillExhausted = this.state.backfillExhausted;
            const events = await this.loadFileEventsWithOptionalBackfill(room, this.state.cursor, backfillExhausted);
            backfillExhausted = events.backfillExhausted;

            const newCursor = events.cursor ?? this.state.cursor;
            this.setState((prev) => {
                const existing = new Set(prev.events.map((e) => e.getId()));
                const merged = [...prev.events];

                for (const ev of events.events) {
                    const id = ev.getId();
                    if (!id || existing.has(id)) continue;
                    existing.add(id);
                    merged.push(ev);
                }

                const exhausted = events.reachedEnd;
                return { ...prev, events: merged, cursor: newCursor, exhausted, backfillExhausted };
            });

            return !events.reachedEnd;
        } finally {
            this.setState({ loading: false });
        }
    }

    public async componentDidMount(): Promise<void> {
        const client = MatrixClientPeg.safeGet();

        await this.resetAndLoad(this.props.roomId);

        if (!client.isRoomEncrypted(this.props.roomId)) return;
        if (EventIndexPeg.get() !== null) {
            client.on(RoomEvent.Timeline, this.onRoomTimeline);
            client.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
        }
    }

    public async componentDidUpdate(prevProps: IProps): Promise<void> {
        if (prevProps.roomId === this.props.roomId) return;
        await this.resetAndLoad(this.props.roomId);
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

    private onMeasurement = (narrow: boolean): void => {
        this.setState({ narrow });
    };

    private async resetAndLoad(roomId: string): Promise<void> {
        await new Promise<void>((resolve) => {
            this.setState(
                {
                    events: [],
                    cursor: undefined,
                    searchTerm: "",
                    activeTab: FilePanelTab.Files,
                    loading: false,
                    exhausted: false,
                    backfillExhausted: false,
                },
                resolve,
            );
        });

        await this.loadMoreFileEvents();
    }

    private async loadFileEventsWithOptionalBackfill(
        room: Room,
        cursor: string | undefined,
        backfillExhausted: boolean,
    ): Promise<{ events: MatrixEvent[]; cursor?: string; reachedEnd: boolean; backfillExhausted: boolean }> {
        const eventIndex = EventIndexPeg.get();
        if (!eventIndex) return { events: [], cursor, reachedEnd: true, backfillExhausted: true };

        let events = await eventIndex.loadFileEvents(room, FILE_PANEL_BATCH_SIZE, cursor, EventTimeline.BACKWARDS);

        // IndexedDB 里历史不足：按需 backfill 再继续拉取（减少“只能看到最近一天”的困扰）。
        for (
            let i = 0;
            i < FILE_PANEL_MAX_BACKFILL_ATTEMPTS && events.length < FILE_PANEL_BATCH_SIZE && !backfillExhausted;
            i++
        ) {
            const { exhausted, error } = await eventIndex.backfillRoom(room.roomId, FILE_PANEL_BACKFILL_LIMIT);
            if (error) {
                logger.warn("File panel backfill failed", error);
            }
            if (exhausted) {
                backfillExhausted = true;
                break;
            }

            const more = await eventIndex.loadFileEvents(room, FILE_PANEL_BATCH_SIZE, cursor, EventTimeline.BACKWARDS);
            const seen = new Set(events.map((e) => e.getId()));
            events = [
                ...events,
                ...more.filter((e) => {
                    const id = e.getId();
                    if (!id || seen.has(id)) return false;
                    seen.add(id);
                    return true;
                }),
            ];
        }

        const nextCursor = events.length > 0 ? (events[events.length - 1].getId() ?? cursor) : cursor;
        const reachedEnd = backfillExhausted && events.length < FILE_PANEL_BATCH_SIZE;
        return { events, cursor: nextCursor, reachedEnd, backfillExhausted };
    }

    private onFillRequest = async (backwards: boolean): Promise<boolean> => {
        if (backwards) return false;
        return this.loadMoreFileEvents();
    };

    private onSearchChange = (value: string): void => {
        this.setState({ searchTerm: value });
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
        }

        const room = MatrixClientPeg.safeGet().getRoom(this.props.roomId);
        if (!room) {
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

        const emptyState = (
            <EmptyState
                Icon={FilesIcon}
                title={_t("file_panel|empty_heading")}
                description={_t("file_panel|empty_description")}
            />
        );

        const isRoomEncrypted = MatrixClientPeg.safeGet().isRoomEncrypted(this.props.roomId);

        const tabEvents = this.getFilteredEventsForActiveTab(this.state.events);
        const filteredEvents = this.filterByFileName(tabEvents, this.state.searchTerm);

        const listItems: React.ReactNode[] = [];
        if (!filteredEvents.length && !this.state.loading) {
            listItems.push(
                <li key="file-panel-empty" className="mx_FilePanel_empty">
                    {emptyState}
                </li>,
            );
        } else {
            listItems.push(...this.buildGroupedEventTiles(filteredEvents, room.roomId));
        }

        if (this.state.loading && this.state.events.length > 0) {
            listItems.push(
                <li key="file-panel-loading-more" className="mx_FilePanel_loading">
                    <Spinner />
                </li>,
            );
        }

        if (this.state.exhausted && filteredEvents.length > 0) {
            listItems.push(
                <li key="file-panel-no-more" className="mx_FilePanel_noMore">
                    <div className="mx_RoomView_topMarker">{_t("no_more_results")}</div>
                </li>,
            );
        }

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

                    <div className="mx_FilePanel_controls">
                        <Form.Root
                            className="mx_FilePanel_searchForm"
                            onSubmit={(e) => {
                                // compound-web 的 <Search> 内部使用 FormField，
                                // 必须在 <Form.Root> 上下文中渲染；同时避免回车触发表单提交刷新页面。
                                e.preventDefault();
                            }}
                        >
                            <Search
                                className="mx_FilePanel_search"
                                name="file_panel_search"
                                value={this.state.searchTerm}
                                placeholder={_t("file_panel|search_placeholder")}
                                onChange={(e) => this.onSearchChange(e.currentTarget.value)}
                            />
                        </Form.Root>

                        <FilterTabGroup
                            name="file-panel"
                            value={this.state.activeTab}
                            onFilterChange={(tab) => this.setState({ activeTab: tab })}
                            tabs={[
                                { id: FilePanelTab.Media, label: _t("file_panel|tab_media") },
                                { id: FilePanelTab.Files, label: _t("right_panel|files_button") },
                            ]}
                        />
                    </div>

                    <ScrollPanel
                        className="mx_FilePanel_scrollPanel"
                        startAtBottom={false}
                        stickyBottom={false}
                        onFillRequest={this.onFillRequest}
                    >
                        {this.state.loading && this.state.events.length === 0 ? (
                            <li key="file-panel-loading-initial" className="mx_FilePanel_loading">
                                <Spinner />
                            </li>
                        ) : null}
                        {listItems}
                    </ScrollPanel>
                </BaseCard>
            </ScopedRoomContextProvider>
        );
    }

    private getFilteredEventsForActiveTab(events: MatrixEvent[]): MatrixEvent[] {
        const msgtypes = this.state.activeTab === FilePanelTab.Media ? MEDIA_MSGTYPES : FILE_MSGTYPES;
        return events.filter((event) => {
            if (event.getType() !== "m.room.message") return false;
            const msgtype = event.getContent()?.msgtype;
            return typeof msgtype === "string" && msgtypes.has(msgtype);
        });
    }

    private filterByFileName(events: MatrixEvent[], term: string): MatrixEvent[] {
        const q = term.trim().toLowerCase();
        if (!q) return events;
        return events.filter((event) => {
            const body = (event.getContent() as any)?.body;
            return typeof body === "string" && body.toLowerCase().includes(q);
        });
    }

    private buildGroupedEventTiles(events: MatrixEvent[], roomId: string): React.ReactNode[] {
        const nodes: React.ReactNode[] = [];
        let lastGroupKey: string | undefined;

        for (const event of events) {
            const ts = event.getTs();
            const date = new Date(ts);

            const groupKey =
                this.state.activeTab === FilePanelTab.Media
                    ? `${date.getFullYear()}-${date.getMonth()}`
                    : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

            if (groupKey !== lastGroupKey) {
                const label =
                    this.state.activeTab === FilePanelTab.Media
                        ? new Intl.DateTimeFormat(getUserLanguage(), { year: "numeric", month: "long" }).format(date)
                        : formatFullDateNoDayNoTime(date);

                nodes.push(
                    <li key={`group-${groupKey}`} className="mx_FilePanel_groupHeader">
                        <TimelineSeparator label={label}>
                            <span className="mx_FilePanel_groupHeaderLabel">{label}</span>
                        </TimelineSeparator>
                    </li>,
                );
                lastGroupKey = groupKey;
            }

            const eventId = event.getId() ?? `${roomId}-${event.getTs()}`;
            nodes.push(<SearchResultTile key={eventId} resultEvent={event} showDateSeparator={false} />);
        }

        return nodes;
    }
}

export default FilePanel;

enum FilePanelTab {
    Media = "media",
    Files = "files",
}

const FILE_PANEL_BATCH_SIZE = 50;
const FILE_PANEL_BACKFILL_LIMIT = 500;
const FILE_PANEL_MAX_BACKFILL_ATTEMPTS = 3;

const MEDIA_MSGTYPES = new Set(["m.image", "m.video"]);
const FILE_MSGTYPES = new Set(["m.file", "m.audio"]);
const FILE_EVENT_MSGTYPES = new Set(["m.file", "m.image", "m.video", "m.audio"]);
