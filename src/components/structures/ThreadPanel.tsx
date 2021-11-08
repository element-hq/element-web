/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Thread, ThreadEvent } from 'matrix-js-sdk/src/models/thread';
import { EventTimelineSet } from 'matrix-js-sdk/src/models/event-timeline-set';
import { Room } from 'matrix-js-sdk/src/models/room';

import BaseCard from "../views/right_panel/BaseCard";
import { RightPanelPhases } from "../../stores/RightPanelStorePhases";

import ResizeNotifier from '../../utils/ResizeNotifier';
import MatrixClientContext from '../../contexts/MatrixClientContext';
import { _t } from '../../languageHandler';
import { ContextMenuButton } from '../../accessibility/context_menu/ContextMenuButton';
import ContextMenu, { useContextMenu } from './ContextMenu';
import RoomContext, { TimelineRenderingType } from '../../contexts/RoomContext';
import TimelinePanel from './TimelinePanel';
import { Layout } from '../../settings/Layout';
import { useEventEmitter } from '../../hooks/useEventEmitter';
import AccessibleButton from '../views/elements/AccessibleButton';
import { TileShape } from '../views/rooms/EventTile';

interface IProps {
    roomId: string;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
}

export enum ThreadFilterType {
    "My",
    "All"
}

type ThreadPanelHeaderOption = {
    label: string;
    description: string;
    key: ThreadFilterType;
};

const useFilteredThreadsTimelinePanel = ({
    threads,
    room,
    filterOption,
    userId,
    updateTimeline,
}: {
    threads: Map<string, Thread>;
    room: Room;
    userId: string;
    filterOption: ThreadFilterType;
    updateTimeline: () => void;
}) => {
    const timelineSet = useMemo(() => new EventTimelineSet(null, {
        timelineSupport: true,
        unstableClientRelationAggregation: true,
        pendingEvents: false,
    }), []);

    useEffect(() => {
        let filteredThreads = Array.from(threads);
        if (filterOption === ThreadFilterType.My) {
            filteredThreads = filteredThreads.filter(([id, thread]) => {
                return thread.rootEvent.getSender() === userId;
            });
        }
        // NOTE: Temporarily reverse the list until https://github.com/vector-im/element-web/issues/19393 gets properly resolved
        // The proper list order should be top-to-bottom, like in social-media newsfeeds.
        filteredThreads.reverse().forEach(([id, thread]) => {
            const event = thread.rootEvent;
            if (!event || timelineSet.findEventById(event.getId()) || event.status !== null) return;
            timelineSet.addEventToTimeline(
                event,
                timelineSet.getLiveTimeline(),
                true,
            );
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room, timelineSet]);

    useEventEmitter(room, ThreadEvent.Update, (thread) => {
        const event = thread.rootEvent;
        if (
            // If that's a reply and not an event
            event !== thread.replyToEvent &&
            timelineSet.findEventById(event.getId()) ||
            event.status !== null
        ) return;
        if (event !== thread.events[thread.events.length - 1]) {
            timelineSet.removeEvent(thread.events[thread.events.length - 1]);
            timelineSet.removeEvent(event);
        }
        timelineSet.addEventToTimeline(
            event,
            timelineSet.getLiveTimeline(),
            false,
        );
        updateTimeline();
    });

    return timelineSet;
};

export const ThreadPanelHeaderFilterOptionItem = ({
    label,
    description,
    onClick,
    isSelected,
}: ThreadPanelHeaderOption & {
    onClick: () => void;
    isSelected: boolean;
}) => {
    return <AccessibleButton
        aria-selected={isSelected}
        className="mx_ThreadPanel_Header_FilterOptionItem"
        onClick={onClick}
    >
        <span>{ label }</span>
        <span>{ description }</span>
    </AccessibleButton>;
};

export const ThreadPanelHeader = ({ filterOption, setFilterOption }: {
    filterOption: ThreadFilterType;
    setFilterOption: (filterOption: ThreadFilterType) => void;
}) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu<HTMLElement>();
    const options: readonly ThreadPanelHeaderOption[] = [
        {
            label: _t("My threads"),
            description: _t("Shows all threads you've participated in"),
            key: ThreadFilterType.My,
        },
        {
            label: _t("All threads"),
            description: _t('Shows all threads from current room'),
            key: ThreadFilterType.All,
        },
    ];

    const value = options.find(option => option.key === filterOption);
    const contextMenuOptions = options.map(opt => <ThreadPanelHeaderFilterOptionItem
        key={opt.key}
        label={opt.label}
        description={opt.description}
        onClick={() => {
            setFilterOption(opt.key);
            closeMenu();
        }}
        isSelected={opt === value}
    />);
    const contextMenu = menuDisplayed ? <ContextMenu top={0} right={25} onFinished={closeMenu} managed={false}>
        { contextMenuOptions }
    </ContextMenu> : null;
    return <div className="mx_ThreadPanel__header">
        <span>{ _t("Threads") }</span>
        <ContextMenuButton inputRef={button} isExpanded={menuDisplayed} onClick={() => menuDisplayed ? closeMenu() : openMenu()}>
            { `${_t('Show:')} ${value.label}` }
        </ContextMenuButton>
        { contextMenu }
    </div>;
};

const ThreadPanel: React.FC<IProps> = ({ roomId, onClose }) => {
    const mxClient = useContext(MatrixClientContext);
    const roomContext = useContext(RoomContext);
    const room = mxClient.getRoom(roomId);
    const [filterOption, setFilterOption] = useState<ThreadFilterType>(ThreadFilterType.All);
    const ref = useRef<TimelinePanel>();

    const filteredTimelineSet = useFilteredThreadsTimelinePanel({
        threads: room.threads,
        room,
        filterOption,
        userId: mxClient.getUserId(),
        updateTimeline: () => ref.current?.refreshTimeline(),
    });

    return (
        <RoomContext.Provider value={{
            ...roomContext,
            timelineRenderingType: TimelineRenderingType.ThreadsList,
            liveTimeline: filteredTimelineSet.getLiveTimeline(),
            showHiddenEventsInTimeline: true,
        }}>
            <BaseCard
                header={<ThreadPanelHeader filterOption={filterOption} setFilterOption={setFilterOption} />}
                className="mx_ThreadPanel"
                onClose={onClose}
                previousPhase={RightPanelPhases.RoomSummary}
            >
                <TimelinePanel
                    ref={ref}
                    showReadReceipts={false} // No RR support in thread's MVP
                    manageReadReceipts={false} // No RR support in thread's MVP
                    manageReadMarkers={false} // No RM support in thread's MVP
                    sendReadReceiptOnLoad={false} // No RR support in thread's MVP
                    timelineSet={filteredTimelineSet}
                    showUrlPreview={true}
                    empty={<div>empty</div>}
                    alwaysShowTimestamps={true}
                    layout={Layout.Group}
                    hideThreadedMessages={false}
                    hidden={false}
                    showReactions={true}
                    className="mx_RoomView_messagePanel mx_GroupLayout"
                    membersLoaded={true}
                    tileShape={TileShape.ThreadPanel}
                />
            </BaseCard>
        </RoomContext.Provider>
    );
};
export default ThreadPanel;
