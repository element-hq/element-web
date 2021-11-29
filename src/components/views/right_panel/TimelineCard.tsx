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
import { Thread } from 'matrix-js-sdk/src/models/thread';

import BaseCard from "./BaseCard";

import ResizeNotifier from '../../../utils/ResizeNotifier';
import MessageComposer from '../rooms/MessageComposer';
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import { Layout } from '../../../settings/enums/Layout';
import TimelinePanel from '../../structures/TimelinePanel';
import { E2EStatus } from '../../../utils/ShieldUtils';
import EditorStateTransfer from '../../../utils/EditorStateTransfer';
import RoomContext from '../../../contexts/RoomContext';

import { _t } from '../../../languageHandler';
import { replaceableComponent } from '../../../utils/replaceableComponent';

interface IProps {
    room: Room;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
    permalinkCreator?: RoomPermalinkCreator;
    e2eStatus?: E2EStatus;
    initialEvent?: MatrixEvent;
    initialEventHighlighted?: boolean;
}
interface IState {
    thread?: Thread;
    editState?: EditorStateTransfer;
    replyToEvent?: MatrixEvent;
}

@replaceableComponent("structures.TimelineCard")
export default class TimelineCard extends React.Component<IProps, IState> {
    static contextType = RoomContext;

    constructor(props: IProps) {
        super(props);
        this.state = {};
    }

    private renderTimelineCardHeader = (): JSX.Element => {
        return <div className="mx_TimelineCard__header">
            <span>{ _t("Chat") }</span>
        </div>;
    };

    public render(): JSX.Element {
        return (
            <BaseCard
                className="mx_ThreadPanel mx_TimelineCard"
                onClose={this.props.onClose}
                withoutScrollContainer={true}
                header={this.renderTimelineCardHeader()}
            >
                <TimelinePanel
                    showReadReceipts={false} // TODO: RR's cause issues with limited horizontal space
                    manageReadReceipts={true}
                    manageReadMarkers={false} // No RM support in the TimelineCard
                    sendReadReceiptOnLoad={true}
                    timelineSet={this.props.room.getUnfilteredTimelineSet()}
                    showUrlPreview={true}
                    layout={Layout.Group}
                    hideThreadedMessages={false}
                    hidden={false}
                    showReactions={true}
                    className="mx_RoomView_messagePanel mx_GroupLayout"
                    permalinkCreator={this.props.permalinkCreator}
                    membersLoaded={true}
                    editState={this.state.editState}
                    eventId={this.props.initialEvent?.getId()}
                    resizeNotifier={this.props.resizeNotifier}
                />

                <MessageComposer
                    room={this.props.room}
                    resizeNotifier={this.props.resizeNotifier}
                    replyToEvent={this.state.replyToEvent}
                    permalinkCreator={this.props.permalinkCreator}
                    e2eStatus={this.props.e2eStatus}
                    compact={true}
                />
            </BaseCard>
        );
    }
}
