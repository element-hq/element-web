/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";
import { Text } from "@vector-im/compound-web";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import ToastStore, { type IToast } from "../../stores/ToastStore";

interface IState {
    toasts: IToast<any>[];
    countSeen: number;
}

export default class ToastContainer extends React.Component<EmptyObject, IState> {
    public constructor(props: EmptyObject) {
        super(props);
        this.state = {
            toasts: ToastStore.sharedInstance().getToasts(),
            countSeen: ToastStore.sharedInstance().getCountSeen(),
        };
    }

    public componentDidMount(): void {
        ToastStore.sharedInstance().on("update", this.onToastStoreUpdate);
        this.onToastStoreUpdate();
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
                        <Text size="lg" weight="semibold" as="h2">
                            {title}
                        </Text>
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
