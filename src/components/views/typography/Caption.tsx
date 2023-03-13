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

import classNames from "classnames";
import React, { HTMLAttributes } from "react";

interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, "className"> {
    children: React.ReactNode;
    isError?: boolean;
}

export const Caption: React.FC<Props> = ({ children, isError, ...rest }) => {
    return (
        <span
            className={classNames("mx_Caption", {
                mx_Caption_error: isError,
            })}
            {...rest}
        >
            {children}
        </span>
    );
};
