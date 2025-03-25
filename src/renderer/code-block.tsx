/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { type RendererMap } from "./utils.tsx";
import CodeBlock from "../components/views/messages/CodeBlock.tsx";

export const codeBlockRenderer: RendererMap = {
    pre: (pre, { onHeightChanged }) => {
        return <CodeBlock onHeightChanged={onHeightChanged} preNode={pre} />;
    },
};
