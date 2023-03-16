/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>
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

import React, { createContext, ReactNode, useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import classNames from "classnames";

import { _t } from "../../../../languageHandler";
import { XOR } from "../../../../@types/common";
import { Tool } from "../DevtoolsDialog";

export interface IDevtoolsProps {
    onBack(): void;
    setTool(label: string, tool: Tool): void;
}

interface IMinProps extends Pick<IDevtoolsProps, "onBack"> {
    className?: string;
    children?: ReactNode;
}

interface IProps extends IMinProps {
    actionLabel: string;
    onAction(): Promise<string | void>;
}

const BaseTool: React.FC<XOR<IMinProps, IProps>> = ({ className, actionLabel, onBack, onAction, children }) => {
    const [message, setMessage] = useState<string | null>(null);

    const onBackClick = (): void => {
        if (message) {
            setMessage(null);
        } else {
            onBack();
        }
    };

    let actionButton: ReactNode = null;
    if (message) {
        children = message;
    } else if (onAction) {
        const onActionClick = (): void => {
            onAction().then((msg) => {
                if (typeof msg === "string") {
                    setMessage(msg);
                }
            });
        };

        actionButton = <button onClick={onActionClick}>{actionLabel}</button>;
    }

    return (
        <>
            <div className={classNames("mx_DevTools_content", className)}>{children}</div>
            <div className="mx_Dialog_buttons">
                <button onClick={onBackClick}>{_t("Back")}</button>
                {actionButton}
            </div>
        </>
    );
};

export default BaseTool;

interface IContext {
    room: Room;
}

export const DevtoolsContext = createContext<IContext>({} as IContext);
