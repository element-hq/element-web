/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type ImageContent } from "matrix-js-sdk/src/types";

import { MImageBodyInner } from "./MImageBody";
import { type IBodyProps } from "./IBodyProps";
import { useMediaVisible } from "../../../hooks/useMediaVisible";

const FORCED_IMAGE_HEIGHT = 44;

class MImageReplyBodyInner extends MImageBodyInner {
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
const MImageReplyBody: React.FC<IBodyProps> = (props) => {
    const [mediaVisible, setVisible] = useMediaVisible(props.mxEvent.getId()!);
    return <MImageReplyBodyInner mediaVisible={mediaVisible} setMediaVisible={setVisible} {...props} />;
};

export default MImageReplyBody;
