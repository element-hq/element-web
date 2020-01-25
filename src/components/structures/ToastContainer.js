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
import { _t } from '../../languageHandler';
import ToastStore from "../../stores/ToastStore";
import classNames from "classnames";

export default class ToastContainer extends React.Component {
    constructor() {
        super();
        this.state = {toasts: ToastStore.sharedInstance().getToasts()};

        // Start listening here rather than in componentDidMount because
        // toasts may dismiss themselves in their didMount if they find
        // they're already irrelevant by the time they're mounted, and
        // our own componentDidMount is too late.
        ToastStore.sharedInstance().on('update', this._onToastStoreUpdate);
    }

    componentWillUnmount() {
        ToastStore.sharedInstance().removeListener('update', this._onToastStoreUpdate);
    }

    _onToastStoreUpdate = () => {
        this.setState({toasts: ToastStore.sharedInstance().getToasts()});
    };

    render() {
        const totalCount = this.state.toasts.length;
        const isStacked = totalCount > 1;
        let toast;
        if (totalCount !== 0) {
            const topToast = this.state.toasts[0];
            const {title, icon, key, component, props} = topToast;
            const toastClasses = classNames("mx_Toast_toast", {
                "mx_Toast_hasIcon": icon,
                [`mx_Toast_icon_${icon}`]: icon,
            });
            const countIndicator = isStacked ? _t(" (1/%(totalCount)s)", {totalCount}) : null;

            const toastProps = Object.assign({}, props, {
                key,
                toastKey: key,
            });
            toast = (<div className={toastClasses}>
                <h2>{title}{countIndicator}</h2>
                <div className="mx_Toast_body">{React.createElement(component, toastProps)}</div>
            </div>);
        }

        const containerClasses = classNames("mx_ToastContainer", {
            "mx_ToastContainer_stacked": isStacked,
        });

        return (
            <div className={containerClasses} role="alert">
                {toast}
            </div>
        );
    }
}
