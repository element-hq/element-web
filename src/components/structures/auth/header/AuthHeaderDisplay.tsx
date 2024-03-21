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

import React, { Fragment, PropsWithChildren, ReactNode, useContext } from "react";

import { AuthHeaderContext } from "./AuthHeaderContext";

interface Props {
    title: ReactNode;
    icon?: ReactNode;
    serverPicker: ReactNode;
}

export function AuthHeaderDisplay({ title, icon, serverPicker, children }: PropsWithChildren<Props>): JSX.Element {
    const context = useContext(AuthHeaderContext);
    if (!context) {
        return <></>;
    }
    const current = context.state[0] ?? null;
    return (
        <Fragment>
            {current?.icon ?? icon}
            <h1>{current?.title ?? title}</h1>
            {children}
            {current?.hideServerPicker !== true && serverPicker}
        </Fragment>
    );
}
