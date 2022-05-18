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

import React from "react";
import { EventType } from "matrix-js-sdk/src/@types/event";

import MImageBody from "./MImageBody";
import { presentableTextForFile } from "../../../utils/FileUtils";
import { IMediaEventContent } from "../../../customisations/models/IMediaEventContent";
import SenderProfile from "./SenderProfile";
import { _t } from "../../../languageHandler";

const FORCED_IMAGE_HEIGHT = 44;

export default class MImageReplyBody extends MImageBody {
    public onClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
    };

    public wrapImage(contentUrl: string, children: JSX.Element): JSX.Element {
        return children;
    }

    // Don't show "Download this_file.png ..."
    public getFileBody(): string {
        const sticker = this.props.mxEvent.getType() === EventType.Sticker;
        return presentableTextForFile(this.props.mxEvent.getContent(), sticker ? _t("Sticker") : _t("Image"), !sticker);
    }

    protected getBanner(content: IMediaEventContent): JSX.Element {
        return null; // we don't need a banner, nor have space for one
    }

    render() {
        if (this.state.error) {
            return super.render();
        }

        const content = this.props.mxEvent.getContent<IMediaEventContent>();
        const thumbnail = this.messageContent(this.state.contentUrl, this.state.thumbUrl, content, FORCED_IMAGE_HEIGHT);
        const fileBody = this.getFileBody();
        const sender = <SenderProfile
            mxEvent={this.props.mxEvent}
        />;

        return <div className="mx_MImageReplyBody">
            { thumbnail }
            <div className="mx_MImageReplyBody_info">
                <div className="mx_MImageReplyBody_sender">{ sender }</div>
                <div className="mx_MImageReplyBody_filename">{ fileBody }</div>
            </div>
        </div>;
    }
}
