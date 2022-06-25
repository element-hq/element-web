/*
Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.

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

import React, { useContext, useEffect, useRef, useState } from 'react';
import { EventTimelineSet } from 'matrix-js-sdk/src/models/event-timeline-set';
import { Thread, ThreadEvent } from 'matrix-js-sdk/src/models/thread';
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
import { RoomPermalinkCreator } from '../../utils/permalinks/Permalinks';
import Measured from '../views/elements/Measured';
import PosthogTrackers from "../../PosthogTrackers";
import AccessibleButton, { ButtonEvent } from "../views/elements/AccessibleButton";
import { BetaPill } from '../views/beta/BetaCard';
import SdkConfig from '../../SdkConfig';
import Modal from '../../Modal';
import BetaFeedbackDialog from '../views/dialogs/BetaFeedbackDialog';
import { Action } from '../../dispatcher/actions';
import { UserTab } from '../views/dialogs/UserTab';
import dis from '../../dispatcher/dispatcher';
import Spinner from "../views/elements/Spinner";
import Heading from '../views/typography/Heading';

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

export const ThreadPanelHeader = ({ filterOption, setFilterOption, empty }: {
    filterOption: ThreadFilterType;
    setFilterOption: (filterOption: ThreadFilterType) => void;
    empty: boolean;
}) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu<HTMLElement>();
    const options: readonly ThreadPanelHeaderOption[] = [
        {
            label: _t("All threads"),
            description: _t('Shows all threads from current room'),
            key: ThreadFilterType.All,
        },
        {
            label: _t("My threads"),
            description: _t("Shows all threads you've participated in"),
            key: ThreadFilterType.My,
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
        top={108}
        right={33}
        onFinished={closeMenu}
        chevronFace={ChevronFace.Top}
        wrapperClassName="mx_BaseCard_header_title"
    >
        { contextMenuOptions }
    </ContextMenu> : null;
    return <div className="mx_BaseCard_header_title">
        <Heading size="h4" className="mx_BaseCard_header_title_heading">{ _t("Threads") }</Heading>
        { !empty && <>
            <ContextMenuButton
                className="mx_ThreadPanel_dropdown"
                inputRef={button}
                isExpanded={menuDisplayed}
                onClick={(ev: ButtonEvent) => {
                    openMenu();
                    PosthogTrackers.trackInteraction("WebRightPanelThreadPanelFilterDropdown", ev);
                }}
            >
                { `${_t('Show:')} ${value.label}` }
            </ContextMenuButton>
            { contextMenu }
        </> }
    </div>;
};

interface EmptyThreadIProps {
    hasThreads: boolean;
    filterOption: ThreadFilterType;
    showAllThreadsCallback: () => void;
}

const EmptyThread: React.FC<EmptyThreadIProps> = ({ hasThreads, filterOption, showAllThreadsCallback }) => {
    let body: JSX.Element;
    if (hasThreads) {
        body = <>
            <p>
                { _t("Reply to an ongoing thread or use “%(replyInThread)s” "
                    + "when hovering over a message to start a new one.", {
                    replyInThread: _t("Reply in thread"),
                }) }
            </p>
            <p>
                { /* Always display that paragraph to prevent layout shift when hiding the button */ }
                { (filterOption === ThreadFilterType.My)
                    ? <button onClick={showAllThreadsCallback}>{ _t("Show all threads") }</button>
                    : <>&nbsp;</>
                }
            </p>
        </>;
    } else {
        body = <>
            <p>{ _t("Threads help keep your conversations on-topic and easy to track.") }</p>
            <p className="mx_ThreadPanel_empty_tip">
                { _t('<b>Tip:</b> Use “%(replyInThread)s” when hovering over a message.', {
                    replyInThread: _t("Reply in thread"),
                }, {
                    b: sub => <b>{ sub }</b>,
                }) }
            </p>
        </>;
    }

    return <aside className="mx_ThreadPanel_empty">
        <div className="mx_ThreadPanel_largeIcon" />
        <h2>{ _t("Keep discussions organised with threads") }</h2>
        { body }
    </aside>;
};

const ThreadPanel: React.FC<IProps> = ({
    roomId,
    onClose,
    permalinkCreator,
}) => {
    const mxClient = useContext(MatrixClientContext);
    const roomContext = useContext(RoomContext);
    const timelinePanel = useRef<TimelinePanel>();
    const card = useRef<HTMLDivElement>();

    const [filterOption, setFilterOption] = useState<ThreadFilterType>(ThreadFilterType.All);
    const [room, setRoom] = useState<Room | null>(null);
    const [timelineSet, setTimelineSet] = useState<EventTimelineSet | null>(null);
    const [narrow, setNarrow] = useState<boolean>(false);

    useEffect(() => {
        const room = mxClient.getRoom(roomId);
        room.createThreadsTimelineSets().then(() => {
            return room.fetchRoomThreads();
        }).then(() => {
            setFilterOption(ThreadFilterType.All);
            setRoom(room);
        });
    }, [mxClient, roomId]);

    useEffect(() => {
        function refreshTimeline() {
            timelinePanel?.current.refreshTimeline();
        }

        room?.on(ThreadEvent.Update, refreshTimeline);

        return () => {
            room?.removeListener(ThreadEvent.Update, refreshTimeline);
        };
    }, [room, mxClient, timelineSet]);

    useEffect(() => {
        if (room) {
            if (filterOption === ThreadFilterType.My) {
                setTimelineSet(room.threadsTimelineSets[1]);
            } else {
                setTimelineSet(room.threadsTimelineSets[0]);
            }
        }
    }, [room, filterOption]);

    useEffect(() => {
        if (timelineSet && !Thread.hasServerSideSupport) {
            timelinePanel.current.refreshTimeline();
        }
    }, [timelineSet, timelinePanel]);

    const openFeedback = SdkConfig.get().bug_report_endpoint_url ? () => {
        Modal.createDialog(BetaFeedbackDialog, {
            featureId: "feature_thread",
        });
    } : null;

    return (
        <RoomContext.Provider value={{
            ...roomContext,
            timelineRenderingType: TimelineRenderingType.ThreadsList,
            showHiddenEvents: true,
            narrow,
        }}>
            <BaseCard
                header={<ThreadPanelHeader
                    filterOption={filterOption}
                    setFilterOption={setFilterOption}
                    empty={!timelineSet?.getLiveTimeline()?.getEvents().length}
                />}
                footer={<>
                    <BetaPill
                        tooltipTitle={_t("Threads are a beta feature")}
                        tooltipCaption={_t("Click for more info")}
                        onClick={() => {
                            dis.dispatch({
                                action: Action.ViewUserSettings,
                                initialTabId: UserTab.Labs,
                            });
                        }}
                    />
                    { openFeedback && _t("<a>Give feedback</a>", {}, {
                        a: sub =>
                            <AccessibleButton kind="link_inline" onClick={openFeedback}>{ sub }</AccessibleButton>,
                    }) }
                </>}
                className="mx_ThreadPanel"
                onClose={onClose}
                withoutScrollContainer={true}
                ref={card}
            >
                <Measured
                    sensor={card.current}
                    onMeasurement={setNarrow}
                />
                { timelineSet
                    ? <TimelinePanel
                        key={timelineSet.getFilter()?.filterId ?? (roomId + ":" + filterOption)}
                        ref={timelinePanel}
                        showReadReceipts={false} // No RR support in thread's MVP
                        manageReadReceipts={false} // No RR support in thread's MVP
                        manageReadMarkers={false} // No RM support in thread's MVP
                        sendReadReceiptOnLoad={false} // No RR support in thread's MVP
                        timelineSet={timelineSet}
                        showUrlPreview={false} // No URL previews at the threads list level
                        empty={<EmptyThread
                            hasThreads={room.threadsTimelineSets?.[0]?.getLiveTimeline().getEvents().length > 0}
                            filterOption={filterOption}
                            showAllThreadsCallback={() => setFilterOption(ThreadFilterType.All)}
                        />}
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
                    : <div className="mx_AutoHideScrollbar">
                        <Spinner />
                    </div>
                }
            </BaseCard>
        </RoomContext.Provider>
    );
};
export default ThreadPanel;
