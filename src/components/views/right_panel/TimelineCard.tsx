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
import { EventSubscription } from "fbemitter";
import { EventTimelineSet, IEventRelation, MatrixEvent, Room } from 'matrix-js-sdk/src';
import { Thread } from 'matrix-js-sdk/src/models/thread';

import BaseCard from "./BaseCard";
import ResizeNotifier from '../../../utils/ResizeNotifier';
import MessageComposer from '../rooms/MessageComposer';
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import { Layout } from '../../../settings/enums/Layout';
import TimelinePanel from '../../structures/TimelinePanel';
import { E2EStatus } from '../../../utils/ShieldUtils';
import EditorStateTransfer from '../../../utils/EditorStateTransfer';
import RoomContext, { TimelineRenderingType } from '../../../contexts/RoomContext';
import dis from '../../../dispatcher/dispatcher';
import { _t } from '../../../languageHandler';
import { replaceableComponent } from '../../../utils/replaceableComponent';
import { ActionPayload } from '../../../dispatcher/payloads';
import { Action } from '../../../dispatcher/actions';
import RoomViewStore from '../../../stores/RoomViewStore';
import ContentMessages from '../../../ContentMessages';
import UploadBar from '../../structures/UploadBar';
import SettingsStore from '../../../settings/SettingsStore';

interface IProps {
    room: Room;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
    permalinkCreator?: RoomPermalinkCreator;
    e2eStatus?: E2EStatus;
    classNames?: string;
    timelineSet?: EventTimelineSet;
    timelineRenderingType?: TimelineRenderingType;
    showComposer?: boolean;
    composerRelation?: IEventRelation;
}
interface IState {
    thread?: Thread;
    editState?: EditorStateTransfer;
    replyToEvent?: MatrixEvent;
    initialEventId?: string;
    initialEventHighlighted?: boolean;

    // settings:
    showReadReceipts?: boolean;
}

@replaceableComponent("structures.TimelineCard")
export default class TimelineCard extends React.Component<IProps, IState> {
    static contextType = RoomContext;

    private dispatcherRef: string;
    private timelinePanelRef: React.RefObject<TimelinePanel> = React.createRef();
    private roomStoreToken: EventSubscription;
    private readReceiptsSettingWatcher: string;

    constructor(props: IProps) {
        super(props);
        this.state = {
            showReadReceipts: SettingsStore.getValue("showReadReceipts", props.room.roomId),
        };
        this.readReceiptsSettingWatcher = null;
    }

    public componentDidMount(): void {
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
        this.dispatcherRef = dis.register(this.onAction);
        this.readReceiptsSettingWatcher = SettingsStore.watchSetting("showReadReceipts", null,
            (...[,,, value]) => {this.setState({ showReadReceipts: value as boolean });},
        );
    }

    public componentWillUnmount(): void {
        // Remove RoomStore listener
        if (this.roomStoreToken) {
            this.roomStoreToken.remove();
        }
        dis.unregister(this.dispatcherRef);
        if (this.readReceiptsSettingWatcher) {
            SettingsStore.unwatchSetting(this.readReceiptsSettingWatcher);
        }
    }

    private onRoomViewStoreUpdate = async (initial?: boolean): Promise<void> => {
        const newState: Pick<IState, any> = {
            // roomLoading: RoomViewStore.isRoomLoading(),
            // roomLoadError: RoomViewStore.getRoomLoadError(),

            initialEventId: RoomViewStore.getInitialEventId(),
            initialEventHighlighted: RoomViewStore.isInitialEventHighlighted(),
            replyToEvent: RoomViewStore.getQuotingEvent(),
        };

        this.setState(newState);
    };

    private onAction = (payload: ActionPayload): void => {
        switch (payload.action) {
            case Action.EditEvent:
                this.setState({
                    editState: payload.event ? new EditorStateTransfer(payload.event) : null,
                }, () => {
                    if (payload.event) {
                        this.timelinePanelRef.current?.scrollToEventIfNeeded(payload.event.getId());
                    }
                });
                break;
            default:
                break;
        }
    };

    private onScroll = (): void => {
        if (this.state.initialEventId && this.state.initialEventHighlighted) {
            dis.dispatch({
                action: Action.ViewRoom,
                room_id: this.props.room.roomId,
                event_id: this.state.initialEventId,
                highlighted: false,
                replyingToEvent: this.state.replyToEvent,
            });
        }
    };

    private renderTimelineCardHeader = (): JSX.Element => {
        return <div className="mx_TimelineCard__header">
            <span>{ _t("Chat") }</span>
        </div>;
    };

    public render(): JSX.Element {
        const highlightedEventId = this.state.initialEventHighlighted
            ? this.state.initialEventId
            : null;

        return (
            <RoomContext.Provider value={{
                ...this.context,
                timelineRenderingType: this.props.timelineRenderingType ?? this.context.timelineRenderingType,
                liveTimeline: this.props.timelineSet.getLiveTimeline(),
            }}>
                <BaseCard
                    className={this.props.classNames}
                    onClose={this.props.onClose}
                    withoutScrollContainer={true}
                    header={this.renderTimelineCardHeader()}
                >
                    <TimelinePanel
                        ref={this.timelinePanelRef}
                        showReadReceipts={this.state.showReadReceipts}
                        manageReadReceipts={true}
                        manageReadMarkers={false} // No RM support in the TimelineCard
                        sendReadReceiptOnLoad={true}
                        timelineSet={this.props.timelineSet}
                        showUrlPreview={true}
                        layout={Layout.Group}
                        hideThreadedMessages={false}
                        hidden={false}
                        showReactions={true}
                        className="mx_RoomView_messagePanel mx_GroupLayout"
                        permalinkCreator={this.props.permalinkCreator}
                        membersLoaded={true}
                        editState={this.state.editState}
                        eventId={this.state.initialEventId}
                        resizeNotifier={this.props.resizeNotifier}
                        highlightedEventId={highlightedEventId}
                        onUserScroll={this.onScroll}
                    />

                    { ContentMessages.sharedInstance().getCurrentUploads(this.props.composerRelation).length > 0 && (
                        <UploadBar room={this.props.room} relation={this.props.composerRelation} />
                    ) }

                    <MessageComposer
                        room={this.props.room}
                        relation={this.props.composerRelation}
                        resizeNotifier={this.props.resizeNotifier}
                        replyToEvent={this.state.replyToEvent}
                        permalinkCreator={this.props.permalinkCreator}
                        e2eStatus={this.props.e2eStatus}
                        compact={true}
                    />
                </BaseCard>
            </RoomContext.Provider>
        );
    }
}
