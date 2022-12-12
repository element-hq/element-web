/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { useLayoutEffect, useRef } from "react";

import { linkifyElement } from "../../../HtmlUtils";

interface Props {
    as?: string;
    children: React.ReactNode;
    onClick?: (ev: MouseEvent) => void;
}

export function Linkify({ as = "div", children, onClick }: Props): JSX.Element {
    const ref = useRef();

    useLayoutEffect(() => {
        linkifyElement(ref.current);
    }, [children]);

    return React.createElement(as, {
        children,
        ref,
        onClick,
    });
}
