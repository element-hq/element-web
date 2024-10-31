/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import * as React from "react";

import { ComponentClass } from "../../@types/common";
import NonUrgentToastStore from "../../stores/NonUrgentToastStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";

interface IProps {}

interface IState {
    toasts: ComponentClass[];
}

export default class NonUrgentToastContainer extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            toasts: NonUrgentToastStore.instance.components,
        };

        NonUrgentToastStore.instance.on(UPDATE_EVENT, this.onUpdateToasts);
    }

    public componentWillUnmount(): void {
        NonUrgentToastStore.instance.off(UPDATE_EVENT, this.onUpdateToasts);
    }

    private onUpdateToasts = (): void => {
        this.setState({ toasts: NonUrgentToastStore.instance.components });
    };

    public render(): React.ReactNode {
        const toasts = this.state.toasts.map((t, i) => {
            return (
                <div className="mx_NonUrgentToastContainer_toast" key={`toast-${i}`}>
                    {React.createElement(t, {})}
                </div>
            );
        });

        return (
            <div className="mx_NonUrgentToastContainer" role="alert">
                {toasts}
            </div>
        );
    }
}
