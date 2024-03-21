/*
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

import React, { PropsWithChildren, ReactNode } from "react";

import AccessibleButton from "../../elements/AccessibleButton";

interface Props {
    icon?: ReactNode;
    action?: ReactNode;
    onAction?: () => void;
}

export function SettingsBanner({ children, icon, action, onAction }: PropsWithChildren<Props>): JSX.Element {
    return (
        <div className="mx_SettingsBanner">
            {icon}
            <div className="mx_SettingsBanner_content">{children}</div>
            {action && (
                <AccessibleButton kind="primary_outline" onClick={onAction ?? null}>
                    {action}
                </AccessibleButton>
            )}
        </div>
    );
}
