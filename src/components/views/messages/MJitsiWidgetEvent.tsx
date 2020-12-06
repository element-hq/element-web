/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { _t } from "../../../languageHandler";
import WidgetStore from "../../../stores/WidgetStore";
import EventTileBubble from "./EventTileBubble";

interface IProps {
    mxEvent: MatrixEvent;
}

export default class MJitsiWidgetEvent extends React.PureComponent<IProps> {
    constructor(props) {
        super(props);
    }

    render() {
        const url = this.props.mxEvent.getContent()['url'];
        const prevUrl = this.props.mxEvent.getPrevContent()['url'];
        const senderName = this.props.mxEvent.sender?.name || this.props.mxEvent.getSender();

        let joinCopy = _t('Join the conference at the top of this room');
        if (!WidgetStore.instance.isPinned(this.props.mxEvent.getRoomId(), this.props.mxEvent.getStateKey())) {
            joinCopy = _t('Join the conference from the room information card on the right');
        }

        if (!url) {
            // removed
            return <EventTileBubble
                className="mx_MJitsiWidgetEvent"
                title={_t('Video conference ended by %(senderName)s', {senderName})}
            />;
        } else if (prevUrl) {
            // modified
            return <EventTileBubble
                className="mx_MJitsiWidgetEvent"
                title={_t('Video conference updated by %(senderName)s', {senderName})}
                subtitle={joinCopy}
            />;
        } else {
            // assume added
            return <EventTileBubble
                className="mx_MJitsiWidgetEvent"
                title={_t("Video conference started by %(senderName)s", {senderName})}
                subtitle={joinCopy}
            />;
        }
    }
}
