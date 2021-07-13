/*
Copyright 2020-2021 Tulir Asokan <tulir@maunium.net>

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
import classNames from 'classnames';
import { _t } from '../../../languageHandler';
import dis from '../../../dispatcher/dispatcher';
import SettingsStore from "../../../settings/SettingsStore";
import { getHandlerTile } from "./EventTile";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import SenderProfile from "../messages/SenderProfile";
import TextualBody from "../messages/TextualBody";
import MImageReplyBody from "../messages/MImageReplyBody";
import * as sdk from '../../../index';
import { EventType, MsgType, RelationType } from 'matrix-js-sdk/src/@types/event';
import { replaceableComponent } from '../../../utils/replaceableComponent';

interface IProps {
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    highlights?: Array<string>;
    highlightLink?: string;
    onHeightChanged?(): void;
}

@replaceableComponent("views.rooms.ReplyTile")
export default class ReplyTile extends React.PureComponent<IProps> {
    static defaultProps = {
        onHeightChanged: () => {},
    };

    componentDidMount() {
        this.props.mxEvent.on("Event.decrypted", this.onDecrypted);
        this.props.mxEvent.on("Event.beforeRedaction", this.onBeforeRedaction);
    }

    componentWillUnmount() {
        this.props.mxEvent.removeListener("Event.decrypted", this.onDecrypted);
    }

    private onDecrypted = (): void => {
        this.forceUpdate();
        if (this.props.onHeightChanged) {
            this.props.onHeightChanged();
        }
    };

    private onBeforeRedaction = (): void => {
        // When the event gets redacted, update it, so that a different tile handler is used
        this.forceUpdate();
    };

    private onClick = (e: React.MouseEvent): void => {
        // This allows the permalink to be opened in a new tab/window or copied as
        // matrix.to, but also for it to enable routing within Riot when clicked.
        e.preventDefault();
        dis.dispatch({
            action: 'view_room',
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
        });
    };

    render() {
        const content = this.props.mxEvent.getContent();
        const msgtype = content.msgtype;
        const eventType = this.props.mxEvent.getType();

        // Info messages are basically information about commands processed on a room
        let isInfoMessage = [
            EventType.RoomMessage,
            EventType.Sticker,
            EventType.RoomCreate,
        ].includes(eventType as EventType);

        let tileHandler = getHandlerTile(this.props.mxEvent);
        // If we're showing hidden events in the timeline, we should use the
        // source tile when there's no regular tile for an event and also for
        // replace relations (which otherwise would display as a confusing
        // duplicate of the thing they are replacing).
        const useSource = !tileHandler || this.props.mxEvent.isRelation(RelationType.Replace);
        if (useSource && SettingsStore.getValue("showHiddenEventsInTimeline")) {
            tileHandler = "messages.ViewSourceEvent";
            // Reuse info message avatar and sender profile styling
            isInfoMessage = true;
        }
        // This shouldn't happen: the caller should check we support this type
        // before trying to instantiate us
        if (!tileHandler) {
            const { mxEvent } = this.props;
            console.warn(`Event type not supported: type:${mxEvent.getType()} isState:${mxEvent.isState()}`);
            return <div className="mx_ReplyTile mx_ReplyTile_info mx_MNoticeBody">
                { _t('This event could not be displayed') }
            </div>;
        }

        const EventTileType = sdk.getComponent(tileHandler);

        const classes = classNames("mx_ReplyTile", {
            mx_ReplyTile_info: isInfoMessage,
        });

        let permalink = "#";
        if (this.props.permalinkCreator) {
            permalink = this.props.permalinkCreator.forEvent(this.props.mxEvent.getId());
        }

        let sender;
        const needsSenderProfile = msgtype !== MsgType.Image && tileHandler !== EventType.RoomCreate && !isInfoMessage;

        if (needsSenderProfile) {
            sender = <SenderProfile
                mxEvent={this.props.mxEvent}
                enableFlair={false}
            />;
        }

        const msgtypeOverrides = {
            [MsgType.Image]: MImageReplyBody,
            // We don't want a download link for files, just the file name is enough.
            [MsgType.File]: TextualBody,
            "m.sticker": TextualBody,
            [MsgType.Audio]: TextualBody,
            [MsgType.Video]: TextualBody,
        };
        const evOverrides = {
            [EventType.Sticker]: TextualBody,
        };

        return (
            <div className={classes}>
                <a href={permalink} onClick={this.onClick}>
                    { sender }
                    <EventTileType
                        ref="tile"
                        mxEvent={this.props.mxEvent}
                        highlights={this.props.highlights}
                        highlightLink={this.props.highlightLink}
                        onHeightChanged={this.props.onHeightChanged}
                        showUrlPreview={false}
                        overrideBodyTypes={msgtypeOverrides}
                        overrideEventTypes={evOverrides}
                        maxImageHeight={96} />
                </a>
            </div>
        );
    }
}
