/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
