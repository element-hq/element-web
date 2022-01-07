/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from 'react';
import { EventType, MsgType } from "matrix-js-sdk/src/@types/event";
import { Relations } from 'matrix-js-sdk/src/models/relations';
import { POLL_START_EVENT_TYPE } from "matrix-js-sdk/src/@types/polls";
import { LOCATION_EVENT_TYPE } from 'matrix-js-sdk/src/@types/location';

import * as sdk from '../../../index';
import SettingsStore from "../../../settings/SettingsStore";
import { Mjolnir } from "../../../mjolnir/Mjolnir";
import RedactedBody from "./RedactedBody";
import UnknownBody from "./UnknownBody";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { IMediaBody } from "./IMediaBody";
import { IOperableEventTile } from "../context_menus/MessageContextMenu";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { ReactAnyComponent } from "../../../@types/common";
import { IBodyProps } from "./IBodyProps";

// onMessageAllowed is handled internally
interface IProps extends Omit<IBodyProps, "onMessageAllowed"> {
    /* overrides for the msgtype-specific components, used by ReplyTile to override file rendering */
    overrideBodyTypes?: Record<string, React.Component>;
    overrideEventTypes?: Record<string, React.Component>;

    // helper function to access relations for this event
    getRelationsForEvent?: (eventId: string, relationType: string, eventType: string) => Relations;
}

@replaceableComponent("views.messages.MessageEvent")
export default class MessageEvent extends React.Component<IProps> implements IMediaBody, IOperableEventTile {
    private body: React.RefObject<React.Component | IOperableEventTile> = createRef();
    private mediaHelper: MediaEventHelper;

    public constructor(props: IProps) {
        super(props);

        if (MediaEventHelper.isEligible(this.props.mxEvent)) {
            this.mediaHelper = new MediaEventHelper(this.props.mxEvent);
        }
    }

    public componentWillUnmount() {
        this.mediaHelper?.destroy();
    }

    public componentDidUpdate(prevProps: Readonly<IProps>) {
        if (this.props.mxEvent !== prevProps.mxEvent && MediaEventHelper.isEligible(this.props.mxEvent)) {
            this.mediaHelper?.destroy();
            this.mediaHelper = new MediaEventHelper(this.props.mxEvent);
        }
    }

    private get bodyTypes(): Record<string, React.Component> {
        return {
            [MsgType.Text]: sdk.getComponent('messages.TextualBody'),
            [MsgType.Notice]: sdk.getComponent('messages.TextualBody'),
            [MsgType.Emote]: sdk.getComponent('messages.TextualBody'),
            [MsgType.Image]: sdk.getComponent('messages.MImageBody'),
            [MsgType.File]: sdk.getComponent('messages.MFileBody'),
            [MsgType.Audio]: sdk.getComponent('messages.MVoiceOrAudioBody'),
            [MsgType.Video]: sdk.getComponent('messages.MVideoBody'),

            ...(this.props.overrideBodyTypes || {}),
        };
    }

    private get evTypes(): Record<string, React.Component> {
        return {
            [EventType.Sticker]: sdk.getComponent('messages.MStickerBody'),

            ...(this.props.overrideEventTypes || {}),
        };
    }

    public getEventTileOps = () => {
        return (this.body.current as IOperableEventTile)?.getEventTileOps?.() || null;
    };

    public getMediaHelper() {
        return this.mediaHelper;
    }

    private onTileUpdate = () => {
        this.forceUpdate();
    };

    public render() {
        const content = this.props.mxEvent.getContent();
        const type = this.props.mxEvent.getType();
        const msgtype = content.msgtype;
        let BodyType: ReactAnyComponent = RedactedBody;
        if (!this.props.mxEvent.isRedacted()) {
            // only resolve BodyType if event is not redacted
            if (type && this.evTypes[type]) {
                BodyType = this.evTypes[type];
            } else if (msgtype && this.bodyTypes[msgtype]) {
                BodyType = this.bodyTypes[msgtype];
            } else if (content.url) {
                // Fallback to MFileBody if there's a content URL
                BodyType = this.bodyTypes[MsgType.File];
            } else {
                // Fallback to UnknownBody otherwise if not redacted
                BodyType = UnknownBody;
            }

            if (type && type === POLL_START_EVENT_TYPE.name) {
                // TODO: this can all disappear when Polls comes out of labs -
                // instead, add something like this into this.evTypes:
                // [EventType.Poll]: "messages.MPollBody"
                if (SettingsStore.getValue("feature_polls")) {
                    BodyType = sdk.getComponent('messages.MPollBody');
                }
            }

            if (
                LOCATION_EVENT_TYPE.matches(type) ||
                (type === EventType.RoomMessage && msgtype === MsgType.Location)
            ) {
                // TODO: tidy this up once location sharing is out of labs
                if (SettingsStore.getValue("feature_location_share")) {
                    BodyType = sdk.getComponent('messages.MLocationBody');
                }
            }
        }

        if (SettingsStore.getValue("feature_mjolnir")) {
            const key = `mx_mjolnir_render_${this.props.mxEvent.getRoomId()}__${this.props.mxEvent.getId()}`;
            const allowRender = localStorage.getItem(key) === "true";

            if (!allowRender) {
                const userDomain = this.props.mxEvent.getSender().split(':').slice(1).join(':');
                const userBanned = Mjolnir.sharedInstance().isUserBanned(this.props.mxEvent.getSender());
                const serverBanned = Mjolnir.sharedInstance().isServerBanned(userDomain);

                if (userBanned || serverBanned) {
                    BodyType = sdk.getComponent('messages.MjolnirBody');
                }
            }
        }

        // @ts-ignore - this is a dynamic react component
        return BodyType ? <BodyType
            ref={this.body}
            mxEvent={this.props.mxEvent}
            highlights={this.props.highlights}
            highlightLink={this.props.highlightLink}
            showUrlPreview={this.props.showUrlPreview}
            tileShape={this.props.tileShape}
            forExport={this.props.forExport}
            maxImageHeight={this.props.maxImageHeight}
            replacingEventId={this.props.replacingEventId}
            editState={this.props.editState}
            onHeightChanged={this.props.onHeightChanged}
            onMessageAllowed={this.onTileUpdate}
            permalinkCreator={this.props.permalinkCreator}
            mediaEventHelper={this.mediaHelper}
            getRelationsForEvent={this.props.getRelationsForEvent}
        /> : null;
    }
}
