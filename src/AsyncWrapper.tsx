/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ComponentType, PropsWithChildren } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "./languageHandler";
import BaseDialog from "./components/views/dialogs/BaseDialog";
import DialogButtons from "./components/views/elements/DialogButtons";
import Spinner from "./components/views/elements/Spinner";

type AsyncImport<T> = { default: T };

interface IProps {
    // A promise which resolves with the real component
    prom: Promise<ComponentType<any> | AsyncImport<ComponentType<any>>>;
    onFinished(): void;
}

interface IState {
    component?: ComponentType<PropsWithChildren<any>>;
    error?: Error;
}

/**
 * Wrap an asynchronous loader function with a react component which shows a
 * spinner until the real component loads.
 */
export default class AsyncWrapper extends React.Component<IProps, IState> {
    private unmounted = false;

    public state: IState = {};

    public componentDidMount(): void {
        this.props.prom
            .then((result) => {
                if (this.unmounted) return;

                // Take the 'default' member if it's there, then we support
                // passing in just an import()ed module, since ES6 async import
                // always returns a module *namespace*.
                const component = (result as AsyncImport<ComponentType>).default
                    ? (result as AsyncImport<ComponentType>).default
                    : (result as ComponentType);
                this.setState({ component });
            })
            .catch((e) => {
                logger.warn("AsyncWrapper promise failed", e);
                this.setState({ error: e });
            });
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private onWrapperCancelClick = (): void => {
        this.props.onFinished();
    };

    public render(): React.ReactNode {
        if (this.state.component) {
            const Component = this.state.component;
            return <Component {...this.props} />;
        } else if (this.state.error) {
            return (
                <BaseDialog onFinished={this.props.onFinished} title={_t("common|error")}>
                    {_t("failed_load_async_component")}
                    <DialogButtons
                        primaryButton={_t("action|dismiss")}
                        onPrimaryButtonClick={this.onWrapperCancelClick}
                        hasCancel={false}
                    />
                </BaseDialog>
            );
        } else {
            // show a spinner until the component is loaded.
            return <Spinner />;
        }
    }
}
