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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import SenderProfile from "../messages/SenderProfile";
import MImageReplyBody from "../messages/MImageReplyBody";
import * as sdk from '../../../index';
import { EventType, MsgType } from 'matrix-js-sdk/src/@types/event';
import { replaceableComponent } from '../../../utils/replaceableComponent';
import { getEventDisplayInfo } from '../../../utils/EventUtils';
import MFileBody from "../messages/MFileBody";

interface IProps {
    mxEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    highlights?: string[];
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
        this.props.mxEvent.on("Event.beforeRedaction", this.onEventRequiresUpdate);
        this.props.mxEvent.on("Event.replaced", this.onEventRequiresUpdate);
    }

    componentWillUnmount() {
        this.props.mxEvent.removeListener("Event.decrypted", this.onDecrypted);
        this.props.mxEvent.removeListener("Event.beforeRedaction", this.onEventRequiresUpdate);
        this.props.mxEvent.removeListener("Event.replaced", this.onEventRequiresUpdate);
    }

    private onDecrypted = (): void => {
        this.forceUpdate();
        if (this.props.onHeightChanged) {
            this.props.onHeightChanged();
        }
    };

    private onEventRequiresUpdate = (): void => {
        // Force update when necessary - redactions and edits
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
        const mxEvent = this.props.mxEvent;
        const msgType = mxEvent.getContent().msgtype;
        const evType = mxEvent.getType() as EventType;

        const { tileHandler, isInfoMessage } = getEventDisplayInfo(this.props.mxEvent);
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
            mx_ReplyTile_info: isInfoMessage && !this.props.mxEvent.isRedacted(),
            mx_ReplyTile_audio: msgType === MsgType.Audio,
            mx_ReplyTile_video: msgType === MsgType.Video,
        });

        let permalink = "#";
        if (this.props.permalinkCreator) {
            permalink = this.props.permalinkCreator.forEvent(this.props.mxEvent.getId());
        }

        let sender;
        const needsSenderProfile = (
            !isInfoMessage &&
            msgType !== MsgType.Image &&
            tileHandler !== EventType.RoomCreate &&
            evType !== EventType.Sticker
        );

        if (needsSenderProfile) {
            sender = <SenderProfile
                mxEvent={this.props.mxEvent}
                enableFlair={false}
            />;
        }

        const msgtypeOverrides = {
            [MsgType.Image]: MImageReplyBody,
            // Override audio and video body with file body. We also hide the download/decrypt button using CSS
            [MsgType.Audio]: MFileBody,
            [MsgType.Video]: MFileBody,
        };
        const evOverrides = {
            // Use MImageReplyBody so that the sticker isn't taking up a lot of space
            [EventType.Sticker]: MImageReplyBody,
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
                        replacingEventId={this.props.mxEvent.replacingEventId()}
                        maxImageHeight={96} />
                </a>
            </div>
        );
    }
}
