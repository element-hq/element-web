/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { domToReact, type DOMNode } from "html-react-parser";

import { type ReplacerMap } from "./reactHtmlParser.tsx";
import Spoiler from "../components/views/elements/Spoiler.tsx";

export const spoilerifyReplacer: ReplacerMap = {
    span: (span) => {
        const reason = span.attribs["data-mx-spoiler"];
        if (reason === "string") {
            return <Spoiler reason={reason}>{domToReact(span.children as DOMNode[])}</Spoiler>;
        }
    },
};
