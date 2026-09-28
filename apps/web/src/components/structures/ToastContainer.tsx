/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { createPortal } from "react-dom";
import classNames from "classnames";
import { IconButton, Text } from "@vector-im/compound-web";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import ToastStore, { type IToast } from "../../stores/ToastStore";
import { _t } from "../../languageHandler";
import { getOrCreateMasterContainer } from "../views/elements/PersistedElement";

interface IState {
    toasts: IToast<any>[];
}

export default class ToastContainer extends React.Component<EmptyObject, IState> {
    public constructor(props: EmptyObject) {
        super(props);
        this.state = {
            toasts: ToastStore.sharedInstance().getToasts(),
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
        });
    };

    private renderToast(toast: IToast<any>): React.ReactNode {
        const { title, icon, key, component, className, bodyClassName, onCloseButtonClicked, props } = toast;
        const bodyClasses = classNames("mx_Toast_body", bodyClassName);
        const toastClasses = classNames("mx_Toast_toast", className, {
            mx_Toast_hasIcon: !!icon,
        });
        const toastProps = Object.assign({}, props, {
            key,
            toastKey: key,
        });
        const content = React.createElement(component, toastProps);

        let titleElement;
        if (title) {
            titleElement = (
                <>
                    <div className="mx_Toast_title">
                        <Text size="lg" weight="semibold" as="h2">
                            {title}
                        </Text>
                    </div>
                    {onCloseButtonClicked && (
                        <IconButton
                            className="mx_Toast_closebutton"
                            size="28px"
                            onClick={onCloseButtonClicked}
                            tooltip={_t("action|close")}
                            kind="secondary"
                        >
                            <CloseIcon />
                        </IconButton>
                    )}
                </>
            );
        }

        return (
            <div className={toastClasses} key={key}>
                {icon}
                {titleElement}
                <div className={bodyClasses}>{content}</div>
            </div>
        );
    }

    public render(): React.ReactNode {
        if (this.state.toasts.length === 0) return null;
        // The top toast, and every ringing call: a second caller must not hide behind the first
        const [top, ...rest] = this.state.toasts;
        const shown = [top, ...rest.filter((t) => t.bodyClassName === "mx_IncomingCallToast")];
        const containerClasses = classNames("mx_ToastContainer", {
            mx_ToastContainer_stacked: shown.length < this.state.toasts.length,
        });
        // #matrixchat is its own stacking context (contain: strict) painted under the persisted
        // elements, so a toast can only sit above a call by living in the calls' context
        return createPortal(
            <div className={containerClasses} role="alert">
                {shown.map((t) => this.renderToast(t))}
            </div>,
            getOrCreateMasterContainer(),
        );
    }
}
