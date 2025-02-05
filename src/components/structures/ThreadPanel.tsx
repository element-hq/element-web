/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Optional } from "matrix-events-sdk";
import React, { useContext, useEffect, useRef, useState } from "react";
import { type EventTimelineSet, type Room, Thread } from "matrix-js-sdk/src/matrix";
import { IconButton, Tooltip } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/src/logger";
import ThreadsIcon from "@vector-im/compound-design-tokens/assets/web/icons/threads";

import { Icon as MarkAllThreadsReadIcon } from "../../../res/img/element-icons/check-all.svg";
import BaseCard from "../views/right_panel/BaseCard";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import MatrixClientContext, { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import { _t } from "../../languageHandler";
import { ContextMenuButton } from "../../accessibility/context_menu/ContextMenuButton";
import ContextMenu, { ChevronFace, MenuItemRadio, useContextMenu } from "./ContextMenu";
import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import TimelinePanel from "./TimelinePanel";
import { Layout } from "../../settings/enums/Layout";
import { type RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import Measured from "../views/elements/Measured";
import PosthogTrackers from "../../PosthogTrackers";
import { type ButtonEvent } from "../views/elements/AccessibleButton";
import Spinner from "../views/elements/Spinner";
import { clearRoomNotification } from "../../utils/notifications";
import EmptyState from "../views/right_panel/EmptyState";
import { ScopedRoomContextProvider, useScopedRoomContext } from "../../contexts/ScopedRoomContext.tsx";

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
}> = ({ filterOption, setFilterOption }) => {
    const mxClient = useMatrixClientContext();
    const roomContext = useScopedRoomContext("room");
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
        (e: React.MouseEvent) => {
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
        <div className="mx_ThreadPanelHeader">
            <Tooltip label={_t("threads|mark_all_read")}>
                <IconButton onClick={onMarkAllThreadsReadClick} size="28px">
                    <MarkAllThreadsReadIcon height={20} width={20} />
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
        </div>
    );
};

const ThreadPanel: React.FC<IProps> = ({ roomId, onClose, permalinkCreator }) => {
    const mxClient = useContext(MatrixClientContext);
    const roomContext = useContext(RoomContext);
    const timelinePanel = useRef<TimelinePanel | null>(null);
    const card = useRef<HTMLDivElement | null>(null);
    const closeButonRef = useRef<HTMLButtonElement | null>(null);

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

    return (
        <ScopedRoomContextProvider
            {...roomContext}
            timelineRenderingType={TimelineRenderingType.ThreadsList}
            showHiddenEvents={true}
            narrow={narrow}
        >
            <BaseCard
                header={_t("common|threads")}
                id="thread-panel"
                className="mx_ThreadPanel"
                ariaLabelledBy="thread-panel-tab"
                role="tabpanel"
                onClose={onClose}
                withoutScrollContainer={true}
                ref={card}
                closeButtonRef={closeButonRef}
            >
                {hasThreads && <ThreadPanelHeader filterOption={filterOption} setFilterOption={setFilterOption} />}
                <Measured sensor={card} onMeasurement={setNarrow} />
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
                            <EmptyState
                                Icon={ThreadsIcon}
                                title={_t("threads|empty_title")}
                                description={_t("threads|empty_description", {
                                    replyInThread: _t("action|reply_in_thread"),
                                })}
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
        </ScopedRoomContextProvider>
    );
};
export default ThreadPanel;
