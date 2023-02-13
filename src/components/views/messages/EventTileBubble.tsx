/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, { forwardRef, ReactNode, ReactChild } from "react";
import classNames from "classnames";

interface IProps {
    className: string;
    title: string;
    timestamp?: JSX.Element;
    subtitle?: ReactNode;
    children?: ReactChild;
}

const EventTileBubble = forwardRef<HTMLDivElement, IProps>(
    ({ className, title, timestamp, subtitle, children }, ref) => {
        return (
            <div className={classNames("mx_EventTileBubble", className)} ref={ref}>
                <div className="mx_EventTileBubble_title">{title}</div>
                {subtitle && <div className="mx_EventTileBubble_subtitle">{subtitle}</div>}
                {children}
                {timestamp}
            </div>
        );
    },
);

export default EventTileBubble;
