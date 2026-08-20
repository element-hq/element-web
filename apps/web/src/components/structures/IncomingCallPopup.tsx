/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type EmptyObject, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MatrixCall } from "matrix-js-sdk/src/webrtc/call";

import ToastStore, { type IToast } from "../../stores/ToastStore";
import SettingsStore from "../../settings/SettingsStore";
import { isIncomingCallToast } from "../../toasts/incomingCallToasts";
import { IncomingCallViewEC, IncomingCallViewLegacy } from "../views/voip/IncomingCallView";

interface IState {
    callToast?: IToast<any>;
}

/**
 * A prominent, full-screen incoming-call surface (Skype/Slack-huddle style).
 *
 * Driven by the same {@link ToastStore} entries and lifecycle hook as the compact
 * {@link IncomingCallToast}. When the "raiseWindowOnCall" setting is enabled,
 * incoming-call toasts are rendered here full-screen instead of in the corner
 * {@link ToastContainer} when the "fullScreenCallNotification" setting is enabled,
 * so exactly one lifecycle instance exists and the ring is not started twice. Both
 * surfaces read the setting directly in render (no cached watcher state) so they
 * always agree on ownership within a render pass.
 *
 * Only the single incoming-call toast is tracked in state (not the whole toast
 * list), so unrelated toast churn doesn't re-render this always-mounted component.
 */
export default class IncomingCallPopup extends React.Component<EmptyObject, IState> {
    public constructor(props: EmptyObject) {
        super(props);
        this.state = { callToast: ToastStore.sharedInstance().getToasts().find(isIncomingCallToast) };
    }

    public componentDidMount(): void {
        ToastStore.sharedInstance().on("update", this.onToastStoreUpdate);
    }

    public componentWillUnmount(): void {
        ToastStore.sharedInstance().removeListener("update", this.onToastStoreUpdate);
    }

    private onToastStoreUpdate = (): void => {
        const callToast = ToastStore.sharedInstance().getToasts().find(isIncomingCallToast);
        if (callToast !== this.state.callToast) this.setState({ callToast });
    };

    public render(): React.ReactNode {
        if (!SettingsStore.getValue("fullScreenCallNotification")) return null;

        const callToast = this.state.callToast;
        if (!callToast) return null;

        // Each view owns its own full-screen overlay, so a view that renders null
        // (e.g. an unresolved legacy call) produces nothing — not an empty,
        // un-dismissable backdrop covering the whole app.
        const { key, callKind, props } = callToast;
        switch (callKind) {
            case "ec":
                return (
                    <IncomingCallViewEC
                        notificationEvent={(props as { notificationEvent: MatrixEvent }).notificationEvent}
                        toastKey={key}
                    />
                );
            case "legacy":
                return <IncomingCallViewLegacy call={(props as { call: MatrixCall }).call} />;
            default:
                return null;
        }
    }
}
