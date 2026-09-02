/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { attributesToProps } from "html-react-parser";

import { CustomEmoteInfo } from "../components/views/messages/CustomEmoteInfo";
import { type RendererMap } from "./utils";

/** Preserve keyboard activation while giving sanitized emote images an interactive surface. */
export const customEmoteRenderer: RendererMap = {
    img: (image, { mxEvent, room }) => {
        if (!Object.hasOwn(image.attribs, "data-mx-emoticon")) return;

        return <CustomEmoteInfo {...attributesToProps(image.attribs, "img")} mxEvent={mxEvent} room={room} />;
    },
};
