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

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Thread, ThreadEvent } from 'matrix-js-sdk/src/models/thread';
import { EventTimelineSet } from 'matrix-js-sdk/src/models/event-timeline-set';
import { Room } from 'matrix-js-sdk/src/models/room';

import BaseCard from "../views/right_panel/BaseCard";
import ResizeNotifier from '../../utils/ResizeNotifier';
import MatrixClientContext from '../../contexts/MatrixClientContext';
import { _t } from '../../languageHandler';
import { ContextMenuButton } from '../../accessibility/context_menu/ContextMenuButton';
import ContextMenu, { ChevronFace, MenuItemRadio, useContextMenu } from './ContextMenu';
import RoomContext, { TimelineRenderingType } from '../../contexts/RoomContext';
import TimelinePanel from './TimelinePanel';
import { Layout } from '../../settings/enums/Layout';
import { useEventEmitter } from '../../hooks/useEventEmitter';
import { TileShape } from '../views/rooms/EventTile';
import { RoomPermalinkCreator } from '../../utils/permalinks/Permalinks';

interface IProps {
    roomId: string;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
    permalinkCreator: RoomPermalinkCreator;
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

    const buildThreadList = useCallback(function(timelineSet: EventTimelineSet) {
        timelineSet.resetLiveTimeline("");
        Array.from(threads)
            .forEach(([, thread]) => {
                if (filterOption !== ThreadFilterType.My || thread.hasCurrentUserParticipated) {
                    timelineSet.addLiveEvent(thread.rootEvent);
                }
            });
        updateTimeline();
    }, [filterOption, threads, updateTimeline]);

    useEffect(() => { buildThreadList(timelineSet); }, [timelineSet, buildThreadList]);

    useEventEmitter(room, ThreadEvent.Update, () => { buildThreadList(timelineSet); });
    useEventEmitter(room, ThreadEvent.New, () => { buildThreadList(timelineSet); });

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
    return <MenuItemRadio
        active={isSelected}
        className="mx_ThreadPanel_Header_FilterOptionItem"
        onClick={onClick}
    >
        <span>{ label }</span>
        <span>{ description }</span>
    </MenuItemRadio>;
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
    const contextMenu = menuDisplayed ? <ContextMenu
        top={100}
        right={33}
        onFinished={closeMenu}
        chevronFace={ChevronFace.Top}
        wrapperClassName="mx_ThreadPanel__header"
    >
        { contextMenuOptions }
    </ContextMenu> : null;
    return <div className="mx_ThreadPanel__header">
        <span>{ _t("Threads") }</span>
        <ContextMenuButton className="mx_ThreadPanel_dropdown" inputRef={button} isExpanded={menuDisplayed} onClick={() => menuDisplayed ? closeMenu() : openMenu()}>
            { `${_t('Show:')} ${value.label}` }
        </ContextMenuButton>
        { contextMenu }
    </div>;
};

interface EmptyThreadIProps {
    filterOption: ThreadFilterType;
    showAllThreadsCallback: () => void;
}

const EmptyThread: React.FC<EmptyThreadIProps> = ({ filterOption, showAllThreadsCallback }) => {
    return <aside className="mx_ThreadPanel_empty">
        <div className="mx_ThreadPanel_largeIcon" />
        <h2>{ _t("Keep discussions organised with threads") }</h2>
        <p>{ _t("Threads help you keep conversations on-topic and easily "
              + "track them over time. Create the first one by using the "
              + "\"Reply in thread\" button on a message.") }
        </p>
        <p>
            { /* Always display that paragraph to prevent layout shift
                When hiding the button */ }
            { filterOption === ThreadFilterType.My
                ? <button onClick={showAllThreadsCallback}>{ _t("Show all threads") }</button>
                : <>&nbsp;</>
            }
        </p>
    </aside>;
};

const ThreadPanel: React.FC<IProps> = ({ roomId, onClose, permalinkCreator }) => {
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
                withoutScrollContainer={true}
            >
                <TimelinePanel
                    ref={ref}
                    showReadReceipts={false} // No RR support in thread's MVP
                    manageReadReceipts={false} // No RR support in thread's MVP
                    manageReadMarkers={false} // No RM support in thread's MVP
                    sendReadReceiptOnLoad={false} // No RR support in thread's MVP
                    timelineSet={filteredTimelineSet}
                    showUrlPreview={true}
                    empty={<EmptyThread
                        filterOption={filterOption}
                        showAllThreadsCallback={() => setFilterOption(ThreadFilterType.All)}
                    />}
                    alwaysShowTimestamps={true}
                    layout={Layout.Group}
                    hideThreadedMessages={false}
                    hidden={false}
                    showReactions={true}
                    className="mx_RoomView_messagePanel mx_GroupLayout"
                    membersLoaded={true}
                    permalinkCreator={permalinkCreator}
                    tileShape={TileShape.ThreadPanel}
                    disableGrouping={true}
                />
            </BaseCard>
        </RoomContext.Provider>
    );
};
export default ThreadPanel;
