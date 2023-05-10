/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

import React from "react";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { ActionPayload } from "../../../dispatcher/payloads";
import Spinner from "../elements/Spinner";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import Heading from "../typography/Heading";

interface IProps {
    // false to display an error saying that we couldn't connect to the integration manager
    connected?: boolean;

    // true to display a loading spinner
    loading?: boolean;

    // The source URL to load
    url?: string;

    // callback when the manager is dismissed
    onFinished: () => void;
}

interface IState {
    errored: boolean;
}

export default class IntegrationManager extends React.Component<IProps, IState> {
    private dispatcherRef?: string;

    public static defaultProps: Partial<IProps> = {
        connected: true,
        loading: false,
    };

    public state = {
        errored: false,
    };

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
        document.addEventListener("keydown", this.onKeyDown);
    }

    public componentWillUnmount(): void {
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);
        document.removeEventListener("keydown", this.onKeyDown);
    }

    private onKeyDown = (ev: KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.Escape:
                ev.stopPropagation();
                ev.preventDefault();
                this.props.onFinished();
                break;
        }
    };

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === "close_scalar") {
            this.props.onFinished();
        }
    };

    private onError = (): void => {
        this.setState({ errored: true });
    };

    public render(): React.ReactNode {
        if (this.props.loading) {
            return (
                <div className="mx_IntegrationManager_loading">
                    <Heading size="h3">{_t("Connecting to integration manager…")}</Heading>
                    <Spinner />
                </div>
            );
        }

        if (!this.props.connected || this.state.errored) {
            return (
                <div className="mx_IntegrationManager_error">
                    <Heading size="h3">{_t("Cannot connect to integration manager")}</Heading>
                    <p>{_t("The integration manager is offline or it cannot reach your homeserver.")}</p>
                </div>
            );
        }

        return <iframe title={_t("Integration manager")} src={this.props.url} onError={this.onError} />;
    }
}
