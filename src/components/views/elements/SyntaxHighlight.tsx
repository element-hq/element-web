/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { useAsyncMemo } from "../../../hooks/useAsyncMemo";

interface Props {
    language?: string;
    children: string;
}

export default function SyntaxHighlight({ children, language }: Props): JSX.Element {
    const highlighted = useAsyncMemo(async () => {
        const { default: highlight } = await import("highlight.js");
        return language ? highlight.highlight(children, { language }) : highlight.highlightAuto(children);
    }, [language, children]);

    return (
        <pre className={`mx_SyntaxHighlight hljs language-${highlighted?.language}`}>
            {highlighted ? <code dangerouslySetInnerHTML={{ __html: highlighted.value }} /> : children}
        </pre>
    );
}
