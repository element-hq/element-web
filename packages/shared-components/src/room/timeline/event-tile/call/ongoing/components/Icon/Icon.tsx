/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentType, type SVGAttributes } from "react";
import { VideoCallSolidIcon, VoiceCallSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { CallType } from "../../../common";

interface Props extends SVGAttributes<SVGGElement> {
    /**
     * The type of this call i.e voice or video.
     */
    callType: CallType;
    /**
     * The extra class names to add to the icon.
     */
    classNames?: string;
    /**
     * Height of the icon
     */
    height: number;
    /**
     * Width of the icon
     */
    width: number;
}

/**
 * Component that renders the correct svg icon based on call type.
 */
export const Icon: ComponentType<Props> = ({ callType, classNames, height, width, ...rest }: Props) => {
    switch (callType) {
        case CallType.Video:
            return <VideoCallSolidIcon className={classNames} width={width} height={height} {...rest} />;
        case CallType.Voice:
            return <VoiceCallSolidIcon className={classNames} width={width} height={height} {...rest} />;
    }
};
