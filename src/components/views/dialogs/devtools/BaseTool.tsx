/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createContext, type ReactNode, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import { _t, type TranslationKey } from "../../../../languageHandler";
import { type XOR } from "../../../../@types/common";
import { type Tool } from "../DevtoolsDialog";

export interface IDevtoolsProps {
    onBack(): void;
    setTool(label: TranslationKey, tool: Tool): void;
}

interface IMinProps extends Pick<IDevtoolsProps, "onBack"> {
    className?: string;
    children?: ReactNode;
    extraButton?: ReactNode;
}

interface IProps extends IMinProps {
    actionLabel: TranslationKey;
    onAction(): Promise<string | void>;
}

const BaseTool: React.FC<XOR<IMinProps, IProps>> = ({
    className,
    actionLabel,
    onBack,
    onAction,
    children,
    extraButton,
}) => {
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
    } else if (onAction && actionLabel) {
        const onActionClick = (): void => {
            onAction().then((msg) => {
                if (typeof msg === "string") {
                    setMessage(msg);
                }
            });
        };

        actionButton = <button onClick={onActionClick}>{_t(actionLabel)}</button>;
    }

    return (
        <>
            <div className={classNames("mx_DevTools_content", className)}>{children}</div>
            <div className="mx_Dialog_buttons">
                {extraButton}
                <button onClick={onBackClick}>{_t("action|back")}</button>
                {actionButton}
            </div>
        </>
    );
};

export default BaseTool;

interface IContext {
    room: Room;
    threadRootId?: string | null;
}

export const DevtoolsContext = createContext<IContext>({} as IContext);
