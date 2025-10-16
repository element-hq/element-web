/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 Tulir Asokan <tulir@maunium.net>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { MImageBodyInner } from "./MImageBody";
import { type IBodyProps } from "./IBodyProps";
import { useMediaVisible } from "../../../hooks/useMediaVisible";

const FORCED_IMAGE_HEIGHT = 44;

const MImageReplyBody: React.FC<IBodyProps> = (props) => {
    const [mediaVisible, setVisible] = useMediaVisible(props.mxEvent);

    const onClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
    };

    const wrapImage = (contentUrl: string | null | undefined, children: JSX.Element): JSX.Element => {
        return children;
    };

    return (
        <div className="mx_MImageReplyBody">
            <MImageBodyInner
                mediaVisible={mediaVisible}
                setMediaVisible={setVisible}
                onClick={onClick}
                wrapImage={wrapImage}
                maxImageHeight={FORCED_IMAGE_HEIGHT}
                {...props}
            />
        </div>
    );
};

export default MImageReplyBody;
