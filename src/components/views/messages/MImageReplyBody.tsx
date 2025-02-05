/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type ImageContent } from "matrix-js-sdk/src/types";

import MImageBody from "./MImageBody";

const FORCED_IMAGE_HEIGHT = 44;

export default class MImageReplyBody extends MImageBody {
    public onClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
    };

    public wrapImage(contentUrl: string, children: JSX.Element): JSX.Element {
        return children;
    }

    public render(): React.ReactNode {
        if (this.state.error) {
            return super.render();
        }

        const content = this.props.mxEvent.getContent<ImageContent>();
        const thumbnail = this.state.contentUrl
            ? this.messageContent(this.state.contentUrl, this.state.thumbUrl, content, FORCED_IMAGE_HEIGHT)
            : undefined;

        return <div className="mx_MImageReplyBody">{thumbnail}</div>;
    }
}
