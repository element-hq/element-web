/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ViewModel } from "../shared-components/ViewModel";
import { ViewModelSubscriptions } from "./ViewModelSubscriptions";

export abstract class SubscriptionViewModel<T> implements ViewModel<T> {
    protected subs: ViewModelSubscriptions;

    protected constructor() {
        this.subs = new ViewModelSubscriptions(
            this.addDownstreamSubscriptionWrapper,
            this.removeDownstreamSubscriptionWrapper,
        );
    }

    public subscribe = (listener: () => void): (() => void) => {
        return this.subs.add(listener);
    };

    /**
     * Wrapper around the abstract subscribe callback as we can't assume that the subclassed method
     * has a bound `this` context.
     */
    private addDownstreamSubscriptionWrapper = (): void => {
        this.addDownstreamSubscription();
    };

    /**
     * Wrapper around the abstract unsubscribe callback as we can't call pass an abstract method directly
     * in the constructor.
     */
    private removeDownstreamSubscriptionWrapper = (): void => {
        this.removeDownstreamSubscription();
    };

    /**
     * Called when the first listener subscribes: the subclass should set up any necessary subscriptions
     * to call this.subs.emit() when the snapshot changes.
     */
    protected abstract addDownstreamSubscription(): void;

    /**
     * Called when the last listener unsubscribes: the subclass should clean up any subscriptions.
     */
    protected abstract removeDownstreamSubscription(): void;

    /**
     * Returns the current snapshot of the view model.
     */
    public abstract getSnapshot: () => T;
}
