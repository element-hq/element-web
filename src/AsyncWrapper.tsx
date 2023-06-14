/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

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
                <BaseDialog onFinished={this.props.onFinished} title={_t("Error")}>
                    {_t("Unable to load! Check your network connectivity and try again.")}
                    <DialogButtons
                        primaryButton={_t("Dismiss")}
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
