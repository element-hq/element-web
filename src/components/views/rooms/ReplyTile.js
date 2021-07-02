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
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { _t, _td } from '../../../languageHandler';

import * as sdk from '../../../index';

import dis from '../../../dispatcher/dispatcher';
import SettingsStore from "../../../settings/SettingsStore";
import { MatrixClient } from 'matrix-js-sdk';

import { objectHasDiff } from '../../../utils/objects';
import { getHandlerTile } from "./EventTile";

class ReplyTile extends React.Component {
    static contextTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
    }

    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        isRedacted: PropTypes.bool,
        permalinkCreator: PropTypes.object,
        onHeightChanged: PropTypes.func,
    }

    static defaultProps = {
        onHeightChanged: function() {},
    }

    constructor(props, context) {
        super(props, context);
        this.state = {};
        this.onClick = this.onClick.bind(this);
        this._onDecrypted = this._onDecrypted.bind(this);
    }

    componentDidMount() {
        this.props.mxEvent.on("Event.decrypted", this._onDecrypted);
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (objectHasDiff(this.state, nextState)) {
            return true;
        }

        return objectHasDiff(this.props, nextProps);
    }

    componentWillUnmount() {
        this.props.mxEvent.removeListener("Event.decrypted", this._onDecrypted);
    }

    _onDecrypted() {
        this.forceUpdate();
        if (this.props.onHeightChanged) {
            this.props.onHeightChanged();
        }
    }

    onClick(e) {
        // This allows the permalink to be opened in a new tab/window or copied as
        // matrix.to, but also for it to enable routing within Riot when clicked.
        e.preventDefault();
        dis.dispatch({
            action: 'view_room',
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
        });
    }

    render() {
        const SenderProfile = sdk.getComponent('messages.SenderProfile');

        const content = this.props.mxEvent.getContent();
        const msgtype = content.msgtype;
        const eventType = this.props.mxEvent.getType();

        // Info messages are basically information about commands processed on a room
        let isInfoMessage = (
            eventType !== 'm.room.message' && eventType !== 'm.sticker' && eventType !== 'm.room.create'
        );

        let tileHandler = getHandlerTile(this.props.mxEvent);
        // If we're showing hidden events in the timeline, we should use the
        // source tile when there's no regular tile for an event and also for
        // replace relations (which otherwise would display as a confusing
        // duplicate of the thing they are replacing).
        const useSource = !tileHandler || this.props.mxEvent.isRelation("m.replace");
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

        const classes = classNames({
            mx_ReplyTile: true,
            mx_ReplyTile_info: isInfoMessage,
            mx_ReplyTile_redacted: this.props.isRedacted,
        });

        let permalink = "#";
        if (this.props.permalinkCreator) {
            permalink = this.props.permalinkCreator.forEvent(this.props.mxEvent.getId());
        }

        let sender;
        const needsSenderProfile = msgtype !== 'm.image' && tileHandler !== 'messages.RoomCreate' && !isInfoMessage;

        if (needsSenderProfile) {
            let text = null;
            if (msgtype === 'm.image') text = _td('%(senderName)s sent an image');
            else if (msgtype === 'm.video') text = _td('%(senderName)s sent a video');
            else if (msgtype === 'm.file') text = _td('%(senderName)s uploaded a file');
            sender = <SenderProfile onClick={this.onSenderProfileClick}
                mxEvent={this.props.mxEvent}
                enableFlair={false}
                text={text} />;
        }

        const MImageReplyBody = sdk.getComponent('messages.MImageReplyBody');
        const TextualBody = sdk.getComponent('messages.TextualBody');
        const msgtypeOverrides = {
            "m.image": MImageReplyBody,
            // We don't want a download link for files, just the file name is enough.
            "m.file": TextualBody,
            "m.sticker": TextualBody,
            "m.audio": TextualBody,
            "m.video": TextualBody,
        };
        const evOverrides = {
            "m.sticker": TextualBody,
        };

        return (
            <div className={classes}>
                <a href={permalink} onClick={this.onClick}>
                    { sender }
                    <EventTileType ref="tile"
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

export default ReplyTile;
