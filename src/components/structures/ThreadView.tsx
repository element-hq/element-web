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

import React from 'react';
import { MatrixEvent, Room } from 'matrix-js-sdk/src';
import { Thread, ThreadEvent } from 'matrix-js-sdk/src/models/thread';
import { RelationType } from 'matrix-js-sdk/src/@types/event';

import BaseCard from "../views/right_panel/BaseCard";
import { RightPanelPhases } from "../../stores/RightPanelStorePhases";
import { replaceableComponent } from "../../utils/replaceableComponent";

import ResizeNotifier from '../../utils/ResizeNotifier';
import { TileShape } from '../views/rooms/EventTile';
import MessageComposer from '../views/rooms/MessageComposer';
import { RoomPermalinkCreator } from '../../utils/permalinks/Permalinks';
import { Layout } from '../../settings/Layout';
import TimelinePanel from './TimelinePanel';
import dis from "../../dispatcher/dispatcher";
import { ActionPayload } from '../../dispatcher/payloads';
import { SetRightPanelPhasePayload } from '../../dispatcher/payloads/SetRightPanelPhasePayload';
import { Action } from '../../dispatcher/actions';
import { MatrixClientPeg } from '../../MatrixClientPeg';
import { E2EStatus } from '../../utils/ShieldUtils';
import EditorStateTransfer from '../../utils/EditorStateTransfer';
import RoomContext, { TimelineRenderingType } from '../../contexts/RoomContext';
import { ChevronFace, ContextMenuTooltipButton } from './ContextMenu';
import { _t } from '../../languageHandler';
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from '../views/context_menus/IconizedContextMenu';
import { ButtonEvent } from '../views/elements/AccessibleButton';
import { copyPlaintext } from '../../utils/strings';
import { sleep } from 'matrix-js-sdk/src/utils';

interface IProps {
    room: Room;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    e2eStatus?: E2EStatus;
    initialEvent?: MatrixEvent;
    initialEventHighlighted?: boolean;
}
interface IState {
    thread?: Thread;
    editState?: EditorStateTransfer;
    replyToEvent?: MatrixEvent;
    threadOptionsPosition: DOMRect | null;
    copyingPhase: CopyingPhase;
}

enum CopyingPhase {
    Idle,
    Copying,
    Failed,
}

const contextMenuBelow = (elementRect: DOMRect) => {
    // align the context menu's icons with the icon which opened the context menu
    const left = elementRect.left + window.pageXOffset + elementRect.width;
    const top = elementRect.bottom + window.pageYOffset + 17;
    const chevronFace = ChevronFace.None;
    return { left, top, chevronFace };
};

@replaceableComponent("structures.ThreadView")
export default class ThreadView extends React.Component<IProps, IState> {
    static contextType = RoomContext;

    private dispatcherRef: string;
    private timelinePanelRef: React.RefObject<TimelinePanel> = React.createRef();

    constructor(props: IProps) {
        super(props);
        this.state = {
            threadOptionsPosition: null,
            copyingPhase: CopyingPhase.Idle,
        };
    }

    public componentDidMount(): void {
        this.setupThread(this.props.mxEvent);
        this.dispatcherRef = dis.register(this.onAction);

        const room = MatrixClientPeg.get().getRoom(this.props.mxEvent.getRoomId());
        room.on(ThreadEvent.New, this.onNewThread);
    }

    public componentWillUnmount(): void {
        this.teardownThread();
        dis.unregister(this.dispatcherRef);
        const room = MatrixClientPeg.get().getRoom(this.props.mxEvent.getRoomId());
        room.on(ThreadEvent.New, this.onNewThread);
    }

    public componentDidUpdate(prevProps) {
        if (prevProps.mxEvent !== this.props.mxEvent) {
            this.teardownThread();
            this.setupThread(this.props.mxEvent);
        }

        if (prevProps.room !== this.props.room) {
            dis.dispatch<SetRightPanelPhasePayload>({
                action: Action.SetRightPanelPhase,
                phase: RightPanelPhases.RoomSummary,
            });
        }
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload.phase == RightPanelPhases.ThreadView && payload.event) {
            if (payload.event !== this.props.mxEvent) {
                this.teardownThread();
                this.setupThread(payload.event);
            }
        }
        switch (payload.action) {
            case Action.EditEvent:
                // Quit early if it's not a thread context
                if (payload.timelineRenderingType !== TimelineRenderingType.Thread) return;
                // Quit early if that's not a thread event
                if (payload.event && !payload.event.getThread()) return;
                this.setState({
                    editState: payload.event ? new EditorStateTransfer(payload.event) : null,
                }, () => {
                    if (payload.event) {
                        this.timelinePanelRef.current?.scrollToEventIfNeeded(payload.event.getId());
                    }
                });
                break;
            case 'reply_to_event':
                if (payload.context === TimelineRenderingType.Thread) {
                    this.setState({
                        replyToEvent: payload.event,
                    });
                }
                break;
            default:
                break;
        }
    };

    private setupThread = (mxEv: MatrixEvent) => {
        let thread = mxEv.getThread();
        if (!thread) {
            const client = MatrixClientPeg.get();
            thread = new Thread(
                [mxEv],
                this.props.room,
                client,
            );
            mxEv.setThread(thread);
        }
        thread.on(ThreadEvent.Update, this.updateThread);
        thread.once(ThreadEvent.Ready, this.updateThread);
        this.updateThread(thread);
    };

    private teardownThread = () => {
        if (this.state.thread) {
            this.state.thread.removeListener(ThreadEvent.Update, this.updateThread);
            this.state.thread.removeListener(ThreadEvent.Ready, this.updateThread);
        }
    };

    private onNewThread = (thread: Thread) => {
        if (thread.id === this.props.mxEvent.getId()) {
            this.teardownThread();
            this.setupThread(this.props.mxEvent);
        }
    };

    private updateThread = (thread?: Thread) => {
        if (thread) {
            this.setState({
                thread,
            });
        }

        this.timelinePanelRef.current?.refreshTimeline();
    };

    private onScroll = (): void => {
        if (this.props.initialEvent && this.props.initialEventHighlighted) {
            dis.dispatch({
                action: 'view_room',
                room_id: this.props.room.roomId,
                event_id: this.props.initialEvent?.getId(),
                highlighted: false,
                replyingToEvent: this.state.replyToEvent,
            });
        }
    };

    private onThreadOptionsClick = (ev: ButtonEvent): void => {
        if (this.isThreadOptionsVisible) {
            this.closeThreadOptions();
        } else {
            const position = ev.currentTarget.getBoundingClientRect();
            this.setState({
                threadOptionsPosition: position,
            });
        }
    };

    private closeThreadOptions = (): void => {
        this.setState({
            threadOptionsPosition: null,
        });
    };

    private get isThreadOptionsVisible(): boolean {
        return !!this.state.threadOptionsPosition;
    }

    private viewInRoom = (evt: ButtonEvent): void => {
        evt.preventDefault();
        evt.stopPropagation();
        dis.dispatch({
            action: 'view_room',
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
        });
        this.closeThreadOptions();
    };

    private copyLinkToThread = async (evt: ButtonEvent): Promise<void> => {
        evt.preventDefault();
        evt.stopPropagation();

        const matrixToUrl = this.props.permalinkCreator.forEvent(this.props.mxEvent.getId());

        this.setState({
            copyingPhase: CopyingPhase.Copying,
        });

        const hasSuccessfullyCopied = await copyPlaintext(matrixToUrl);

        if (hasSuccessfullyCopied) {
            await sleep(500);
        } else {
            this.setState({ copyingPhase: CopyingPhase.Failed });
            await sleep(2500);
        }

        this.setState({ copyingPhase: CopyingPhase.Idle });

        if (hasSuccessfullyCopied) {
            this.closeThreadOptions();
        }
    };

    private renderThreadViewHeader = (): JSX.Element => {
        return <div className="mx_ThreadPanel__header">
            <span>{ _t("Thread") }</span>
            <ContextMenuTooltipButton
                className="mx_ThreadPanel_button mx_ThreadPanel_OptionsButton"
                onClick={this.onThreadOptionsClick}
                title={_t("Thread options")}
                isExpanded={this.isThreadOptionsVisible}
            />
            { this.isThreadOptionsVisible && (<IconizedContextMenu
                onFinished={this.closeThreadOptions}
                className="mx_RoomTile_contextMenu"
                compact
                rightAligned
                {...contextMenuBelow(this.state.threadOptionsPosition)}
            >
                <IconizedContextMenuOptionList>
                    <IconizedContextMenuOption
                        onClick={(e) => this.viewInRoom(e)}
                        label={_t("View in room")}
                        iconClassName="mx_ThreadPanel_viewInRoom"
                    />
                    <IconizedContextMenuOption
                        onClick={(e) => this.copyLinkToThread(e)}
                        label={_t("Copy link to thread")}
                        iconClassName="mx_ThreadPanel_copyLinkToThread"
                    />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>) }

        </div>;
    };

    public render(): JSX.Element {
        const highlightedEventId = this.props.initialEventHighlighted
            ? this.props.initialEvent?.getId()
            : null;
        return (
            <RoomContext.Provider value={{
                ...this.context,
                timelineRenderingType: TimelineRenderingType.Thread,
                liveTimeline: this.state?.thread?.timelineSet?.getLiveTimeline(),
            }}>

                <BaseCard
                    className="mx_ThreadView mx_ThreadPanel"
                    onClose={this.props.onClose}
                    previousPhase={RightPanelPhases.ThreadPanel}
                    withoutScrollContainer={true}
                    header={this.renderThreadViewHeader()}
                >
                    { this.state.thread && (
                        <TimelinePanel
                            ref={this.timelinePanelRef}
                            showReadReceipts={false} // No RR support in thread's MVP
                            manageReadReceipts={false} // No RR support in thread's MVP
                            manageReadMarkers={false} // No RM support in thread's MVP
                            sendReadReceiptOnLoad={false} // No RR support in thread's MVP
                            timelineSet={this.state?.thread?.timelineSet}
                            showUrlPreview={true}
                            tileShape={TileShape.Thread}
                            empty={<div>empty</div>}
                            layout={Layout.Group}
                            hideThreadedMessages={false}
                            hidden={false}
                            showReactions={true}
                            className="mx_RoomView_messagePanel mx_GroupLayout"
                            permalinkCreator={this.props.permalinkCreator}
                            membersLoaded={true}
                            editState={this.state.editState}
                            eventId={this.props.initialEvent?.getId()}
                            highlightedEventId={highlightedEventId}
                            onUserScroll={this.onScroll}
                        />
                    ) }

                    { this.state?.thread?.timelineSet && (<MessageComposer
                        room={this.props.room}
                        resizeNotifier={this.props.resizeNotifier}
                        relation={{
                            rel_type: RelationType.Thread,
                            event_id: this.state.thread.id,
                        }}
                        replyToEvent={this.state.replyToEvent}
                        permalinkCreator={this.props.permalinkCreator}
                        e2eStatus={this.props.e2eStatus}
                        compact={true}
                    />) }
                </BaseCard>
            </RoomContext.Provider>
        );
    }
}
