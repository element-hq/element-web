/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import BaseCard from "../views/right_panel/BaseCard";
import { RightPanelPhases } from "../../stores/RightPanelStorePhases";
import { replaceableComponent } from "../../utils/replaceableComponent";
import { MatrixClientPeg } from '../../MatrixClientPeg';

import ResizeNotifier from '../../utils/ResizeNotifier';
import EventTile from '../views/rooms/EventTile';

interface IProps {
    roomId: string;
    onClose: () => void;
    resizeNotifier: ResizeNotifier;
}

interface IState {
    threads?: Thread[];
}

/*
 * Component which shows the filtered file using a TimelinePanel
 */
@replaceableComponent("structures.ThreadView")
class ThreadView extends React.Component<IProps, IState> {
    private room: Room;

    constructor(props: IProps) {
        super(props);
        this.room = MatrixClientPeg.get().getRoom(this.props.roomId);
    }

    public componentDidMount(): void {
        this.room.on("Thread.update", this.onThreadEventReceived);
        this.room.on("Thread.ready", this.onThreadEventReceived);
    }

    public componentWillUnmount(): void {
        this.room.removeListener("Thread.update", this.onThreadEventReceived);
        this.room.removeListener("Thread.ready", this.onThreadEventReceived);
    }

    public onThreadEventReceived = () => this.updateThreads();

    public updateThreads = (callback?: () => void): void => {
        this.setState({
            threads: this.room.getThreads(),
        }, callback);
    };

    public renderEventTile(event: MatrixEvent): JSX.Element {
        return <EventTile
            key={event.getId()}
            mxEvent={event}
            enableFlair={false}
            showReadReceipts={false}
            as="div"
        />;
    }

    public render() {
        return (
            <BaseCard
                className="mx_ThreadPanel"
                onClose={this.props.onClose}
                previousPhase={RightPanelPhases.RoomSummary}
            >
                {
                    this.state?.threads.map((thread: Thread) => {
                        if (thread.ready) {
                            return this.renderEventTile(thread.rootEvent);
                        }
                    })
                }
            </BaseCard>
        );
    }
}

export default ThreadView;
