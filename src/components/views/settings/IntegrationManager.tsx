/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { type ActionPayload } from "../../../dispatcher/payloads";
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
        dis.unregister(this.dispatcherRef);
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
                    <Heading size="3">{_t("integration_manager|connecting")}</Heading>
                    <Spinner />
                </div>
            );
        }

        if (!this.props.connected || this.state.errored) {
            return (
                <div className="mx_IntegrationManager_error">
                    <Heading size="3">{_t("integration_manager|error_connecting_heading")}</Heading>
                    <p>{_t("integration_manager|error_connecting")}</p>
                </div>
            );
        }

        return <iframe title={_t("common|integration_manager")} src={this.props.url} onError={this.onError} />;
    }
}
