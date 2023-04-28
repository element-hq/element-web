/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import classNames from "classnames";

import ToastStore, { IToast } from "../../stores/ToastStore";

interface IState {
    toasts: IToast<any>[];
    countSeen: number;
}

export default class ToastContainer extends React.Component<{}, IState> {
    public constructor(props: {}) {
        super(props);
        this.state = {
            toasts: ToastStore.sharedInstance().getToasts(),
            countSeen: ToastStore.sharedInstance().getCountSeen(),
        };

        // Start listening here rather than in componentDidMount because
        // toasts may dismiss themselves in their didMount if they find
        // they're already irrelevant by the time they're mounted, and
        // our own componentDidMount is too late.
        ToastStore.sharedInstance().on("update", this.onToastStoreUpdate);
    }

    public componentWillUnmount(): void {
        ToastStore.sharedInstance().removeListener("update", this.onToastStoreUpdate);
    }

    private onToastStoreUpdate = (): void => {
        this.setState({
            toasts: ToastStore.sharedInstance().getToasts(),
            countSeen: ToastStore.sharedInstance().getCountSeen(),
        });
    };

    public render(): React.ReactNode {
        const totalCount = this.state.toasts.length;
        const isStacked = totalCount > 1;
        let toast;
        let containerClasses;
        if (totalCount !== 0) {
            const topToast = this.state.toasts[0];
            const { title, icon, key, component, className, bodyClassName, props } = topToast;
            const bodyClasses = classNames("mx_Toast_body", bodyClassName);
            const toastClasses = classNames("mx_Toast_toast", className, {
                mx_Toast_hasIcon: icon,
                [`mx_Toast_icon_${icon}`]: icon,
            });
            const toastProps = Object.assign({}, props, {
                key,
                toastKey: key,
            });
            const content = React.createElement(component, toastProps);

            let countIndicator;
            if ((title && isStacked) || this.state.countSeen > 0) {
                countIndicator = ` (${this.state.countSeen + 1}/${this.state.countSeen + totalCount})`;
            }

            let titleElement;
            if (title) {
                titleElement = (
                    <div className="mx_Toast_title">
                        <h2>{title}</h2>
                        <span className="mx_Toast_title_countIndicator">{countIndicator}</span>
                    </div>
                );
            }

            toast = (
                <div className={toastClasses}>
                    {titleElement}
                    <div className={bodyClasses}>{content}</div>
                </div>
            );

            containerClasses = classNames("mx_ToastContainer", {
                mx_ToastContainer_stacked: isStacked,
            });
        }
        return toast ? (
            <div className={containerClasses} role="alert">
                {toast}
            </div>
        ) : null;
    }
}
