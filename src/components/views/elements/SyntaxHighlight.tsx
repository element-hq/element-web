/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2023 The Matrix.org Foundation C.I.C.

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
