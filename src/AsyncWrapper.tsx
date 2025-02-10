/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, Suspense } from "react";

import { _t } from "./languageHandler";
import BaseDialog from "./components/views/dialogs/BaseDialog";
import DialogButtons from "./components/views/elements/DialogButtons";
import Spinner from "./components/views/elements/Spinner";

interface IProps {
    onFinished(): void;
    children: ReactNode;
}

interface IState {
    error?: Error;
}

/**
 * Wrap an asynchronous loader function with a react component which shows a
 * spinner until the real component loads.
 */
export default class AsyncWrapper extends React.Component<IProps, IState> {
    public static getDerivedStateFromError(error: Error): IState {
        return { error };
    }

    public state: IState = {};

    public render(): React.ReactNode {
        if (this.state.error) {
            return (
                <BaseDialog onFinished={this.props.onFinished} title={_t("common|error")}>
                    {_t("failed_load_async_component")}
                    <DialogButtons
                        primaryButton={_t("action|dismiss")}
                        onPrimaryButtonClick={this.props.onFinished}
                        hasCancel={false}
                    />
                </BaseDialog>
            );
        }

        return <Suspense fallback={<Spinner />}>{this.props.children}</Suspense>;
    }
}
