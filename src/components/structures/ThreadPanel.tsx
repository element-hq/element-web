/*
Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Optional } from "matrix-events-sdk";
import React, { useContext, useEffect, useRef, useState } from "react";
import { EventTimelineSet, Room, Thread } from "matrix-js-sdk/src/matrix";
import { IconButton, Tooltip } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";

import { Icon as MarkAllThreadsReadIcon } from "../../../res/img/element-icons/check-all.svg";
import BaseCard from "../views/right_panel/BaseCard";
import ResizeNotifier from "../../utils/ResizeNotifier";
import MatrixClientContext, { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import { _t } from "../../languageHandler";
import { ContextMenuButton } from "../../accessibility/context_menu/ContextMenuButton";
import ContextMenu, { ChevronFace, MenuItemRadio, useContextMenu } from "./ContextMenu";
import RoomContext, { TimelineRenderingType, useRoomContext } from "../../contexts/RoomContext";
import TimelinePanel from "./TimelinePanel";
import { Layout } from "../../settings/enums/Layout";
import { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import Measured from "../views/elements/Measured";
import PosthogTrackers from "../../PosthogTrackers";
import { ButtonEvent } from "../views/elements/AccessibleButton";
import Spinner from "../views/elements/Spinner";
import Heading from "../views/typography/Heading";
import { clearRoomNotification } from "../../utils/notifications";
import { useDispatcher } from "../../hooks/useDispatcher";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";

interface IProps {
    roomId: string;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
    permalinkCreator: RoomPermalinkCreator;
}

export enum ThreadFilterType {
    "My",
    "All",
}

type ThreadPanelHeaderOption = {
    label: string;
    description: string;
    key: ThreadFilterType;
};

export const ThreadPanelHeaderFilterOptionItem: React.FC<
    ThreadPanelHeaderOption & {
        onClick: () => void;
        isSelected: boolean;
    }
> = ({ label, description, onClick, isSelected }) => {
    return (
        <MenuItemRadio active={isSelected} className="mx_ThreadPanel_Header_FilterOptionItem" onClick={onClick}>
            <span>{label}</span>
            <span>{description}</span>
        </MenuItemRadio>
    );
};

export const ThreadPanelHeader: React.FC<{
    filterOption: ThreadFilterType;
    setFilterOption: (filterOption: ThreadFilterType) => void;
    empty: boolean;
}> = ({ filterOption, setFilterOption, empty }) => {
    const mxClient = useMatrixClientContext();
    const roomContext = useRoomContext();
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu<HTMLElement>();
    const options: readonly ThreadPanelHeaderOption[] = [
        {
            label: _t("threads|all_threads"),
            description: _t("threads|all_threads_description"),
            key: ThreadFilterType.All,
        },
        {
            label: _t("threads|my_threads"),
            description: _t("threads|my_threads_description"),
            key: ThreadFilterType.My,
        },
    ];

    const value = options.find((option) => option.key === filterOption);
    const contextMenuOptions = options.map((opt) => (
        <ThreadPanelHeaderFilterOptionItem
            key={opt.key}
            label={opt.label}
            description={opt.description}
            onClick={() => {
                setFilterOption(opt.key);
                closeMenu();
            }}
            isSelected={opt === value}
        />
    ));
    const contextMenu = menuDisplayed ? (
        <ContextMenu
            top={108}
            right={33}
            onFinished={closeMenu}
            chevronFace={ChevronFace.Top}
            wrapperClassName="mx_BaseCard_header_title"
        >
            {contextMenuOptions}
        </ContextMenu>
    ) : null;

    const onMarkAllThreadsReadClick = React.useCallback(
        (e) => {
            PosthogTrackers.trackInteraction("WebThreadsMarkAllReadButton", e);
            if (!roomContext.room) {
                logger.error("No room in context to mark all threads read");
                return;
            }
            // This actually clears all room notifications by sending an unthreaded read receipt.
            // We'd have to loop over all unread threads (pagninating back to find any we don't
            // know about yet) and send threaded receipts for all of them... or implement a
            // specific API for it. In practice, the user will have to be viewing the room to
            // see this button, so will have marked the room itself read anyway.
            clearRoomNotification(roomContext.room, mxClient).catch((e) => {
                logger.error("Failed to mark all threads read", e);
            });
        },
        [roomContext.room, mxClient],
    );

    return (
        <div className="mx_BaseCard_header_title">
            <Heading size="4" className="mx_BaseCard_header_title_heading">
                {_t("common|threads")}
            </Heading>
            {!empty && (
                <>
                    <Tooltip label={_t("threads|mark_all_read")}>
                        <IconButton
                            onClick={onMarkAllThreadsReadClick}
                            aria-label={_t("threads|mark_all_read")}
                            size="24px"
                        >
                            <MarkAllThreadsReadIcon />
                        </IconButton>
                    </Tooltip>
                    <div className="mx_ThreadPanel_vertical_separator" />
                    <ContextMenuButton
                        className="mx_ThreadPanel_dropdown"
                        ref={button}
                        isExpanded={menuDisplayed}
                        onClick={(ev: ButtonEvent) => {
                            openMenu();
                            PosthogTrackers.trackInteraction("WebRightPanelThreadPanelFilterDropdown", ev);
                        }}
                    >
                        {`${_t("threads|show_thread_filter")} ${value?.label}`}
                    </ContextMenuButton>
                    {contextMenu}
                </>
            )}
        </div>
    );
};

interface EmptyThreadIProps {
    hasThreads: boolean;
    filterOption: ThreadFilterType;
    showAllThreadsCallback: () => void;
}

const EmptyThread: React.FC<EmptyThreadIProps> = ({ hasThreads, filterOption, showAllThreadsCallback }) => {
    let body: JSX.Element;
    if (hasThreads) {
        body = (
            <>
                <p>
                    {_t("threads|empty_has_threads_tip", {
                        replyInThread: _t("action|reply_in_thread"),
                    })}
                </p>
                <p>
                    {/* Always display that paragraph to prevent layout shift when hiding the button */}
                    {filterOption === ThreadFilterType.My ? (
                        <button onClick={showAllThreadsCallback}>{_t("threads|show_all_threads")}</button>
                    ) : (
                        <>&nbsp;</>
                    )}
                </p>
            </>
        );
    } else {
        body = (
            <>
                <p>{_t("threads|empty_explainer")}</p>
                <p className="mx_ThreadPanel_empty_tip">
                    {_t(
                        "threads|empty_tip",
                        {
                            replyInThread: _t("action|reply_in_thread"),
                        },
                        {
                            b: (sub) => <b>{sub}</b>,
                        },
                    )}
                </p>
            </>
        );
    }

    return (
        <div className="mx_ThreadPanel_empty">
            <div className="mx_ThreadPanel_largeIcon" />
            <h2>{_t("threads|empty_heading")}</h2>
            {body}
        </div>
    );
};

const ThreadPanel: React.FC<IProps> = ({ roomId, onClose, permalinkCreator }) => {
    const mxClient = useContext(MatrixClientContext);
    const roomContext = useContext(RoomContext);
    const timelinePanel = useRef<TimelinePanel | null>(null);
    const card = useRef<HTMLDivElement | null>(null);
    const closeButonRef = useRef<HTMLDivElement | null>(null);

    const [filterOption, setFilterOption] = useState<ThreadFilterType>(ThreadFilterType.All);
    const [room, setRoom] = useState<Room | null>(null);
    const [narrow, setNarrow] = useState<boolean>(false);

    const timelineSet: Optional<EventTimelineSet> =
        filterOption === ThreadFilterType.My ? room?.threadsTimelineSets[1] : room?.threadsTimelineSets[0];
    const hasThreads = Boolean(room?.threadsTimelineSets?.[0]?.getLiveTimeline()?.getEvents()?.length);

    useEffect(() => {
        const room = mxClient.getRoom(roomId);
        room
            ?.createThreadsTimelineSets()
            .then(() => room.fetchRoomThreads())
            .then(() => {
                setFilterOption(ThreadFilterType.All);
                setRoom(room);
            });
    }, [mxClient, roomId]);

    useEffect(() => {
        if (timelineSet && !Thread.hasServerSideSupport) {
            timelinePanel.current?.refreshTimeline();
        }
    }, [timelineSet, timelinePanel]);

    useDispatcher(dis, (payload) => {
        // This actually foucses the close button on the threads panel, as its the only interactive element,
        // but at least it puts the user in the right area of the app.
        if (payload.action === Action.FocusThreadsPanel) {
            closeButonRef.current?.focus();
        }
    });

    return (
        <RoomContext.Provider
            value={{
                ...roomContext,
                timelineRenderingType: TimelineRenderingType.ThreadsList,
                showHiddenEvents: true,
                narrow,
            }}
        >
            <BaseCard
                header={
                    <ThreadPanelHeader
                        filterOption={filterOption}
                        setFilterOption={setFilterOption}
                        empty={!hasThreads}
                    />
                }
                className="mx_ThreadPanel"
                onClose={onClose}
                withoutScrollContainer={true}
                ref={card}
                closeButtonRef={closeButonRef}
            >
                {card.current && <Measured sensor={card.current} onMeasurement={setNarrow} />}
                {timelineSet ? (
                    <TimelinePanel
                        key={filterOption + ":" + (timelineSet.getFilter()?.filterId ?? roomId)}
                        ref={timelinePanel}
                        showReadReceipts={false} // No RR support in thread's list
                        manageReadReceipts={false} // No RR support in thread's list
                        manageReadMarkers={false} // No RM support in thread's list
                        sendReadReceiptOnLoad={false} // No RR support in thread's list
                        timelineSet={timelineSet}
                        showUrlPreview={false} // No URL previews at the threads list level
                        empty={
                            <EmptyThread
                                hasThreads={hasThreads}
                                filterOption={filterOption}
                                showAllThreadsCallback={() => setFilterOption(ThreadFilterType.All)}
                            />
                        }
                        alwaysShowTimestamps={true}
                        layout={Layout.Group}
                        hideThreadedMessages={false}
                        hidden={false}
                        showReactions={false}
                        className="mx_RoomView_messagePanel"
                        membersLoaded={true}
                        permalinkCreator={permalinkCreator}
                        disableGrouping={true}
                    />
                ) : (
                    <div className="mx_AutoHideScrollbar">
                        <Spinner />
                    </div>
                )}
            </BaseCard>
        </RoomContext.Provider>
    );
};
export default ThreadPanel;
