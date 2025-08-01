/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ViewModel } from "../../shared-components/ViewModel";
import { Snapshot } from "./Snapshot";
import { ViewModelSubscriptions } from "./ViewModelSubscriptions";

export abstract class BaseViewModel<T, P> implements ViewModel<T> {
    protected subs: ViewModelSubscriptions;
    protected snapshot: Snapshot<T>;
    protected props: P;

    protected constructor(props: P, initialSnapshot: T) {
        this.props = props;
        this.subs = new ViewModelSubscriptions(
            this.addDownstreamSubscriptionWrapper,
            this.removeDownstreamSubscriptionWrapper,
        );
        this.snapshot = new Snapshot(initialSnapshot, () => {
            this.subs.emit();
        });
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
    public getSnapshot = (): T => {
        return this.snapshot.current;
    };
}
