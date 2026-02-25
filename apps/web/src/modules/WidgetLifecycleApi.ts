/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Widget } from "matrix-widget-api";

import type {
    CapabilitiesApprover,
    IdentityApprover,
    PreloadApprover,
    WidgetDescriptor,
    WidgetLifecycleApi as WidgetLifecycleApiInterface,
} from "@element-hq/element-web-module-api";

/**
 * Converts a matrix-widget-api {@link Widget} into a {@link WidgetDescriptor} for the module API.
 * @param widget - The widget instance from matrix-widget-api.
 * @param roomId - The room ID the widget belongs to, if applicable.
 */
export const toWidgetDescriptor = (widget: Widget, roomId?: string): WidgetDescriptor => {
    return {
        id: widget.id,
        templateUrl: widget.templateUrl,
        creatorUserId: widget.creatorUserId,
        type: widget.type,
        origin: widget.origin,
        roomId,
    };
};

/**
 * Host-side implementation of the widget lifecycle API.
 * Allows a single module to register approver callbacks for widget preloading,
 * identity token requests, and capability requests. Only one approver per slot
 * is supported; attempting to register a second throws an error.
 */
export class WidgetLifecycleApi implements WidgetLifecycleApiInterface {
    private preloadApprover?: PreloadApprover;
    private identityApprover?: IdentityApprover;
    private capabilitiesApprover?: CapabilitiesApprover;

    private ensureApproverUnset<T>(current: T | undefined, name: string): void {
        if (current) {
            throw new Error(`Widget lifecycle ${name} approver already registered`);
        }
    }

    /**
     * Register a handler that can auto-approve widget preloading.
     * Only one preload approver may be registered; a second call throws.
     */
    public registerPreloadApprover(approver: PreloadApprover): void {
        this.ensureApproverUnset(this.preloadApprover, "preload");
        this.preloadApprover = approver;
    }

    /**
     * Register a handler that can auto-approve identity token requests.
     * Only one identity approver may be registered; a second call throws.
     */
    public registerIdentityApprover(approver: IdentityApprover): void {
        this.ensureApproverUnset(this.identityApprover, "identity");
        this.identityApprover = approver;
    }

    /**
     * Register a handler that can auto-approve widget capabilities.
     * Only one capabilities approver may be registered; a second call throws.
     */
    public registerCapabilitiesApprover(approver: CapabilitiesApprover): void {
        this.ensureApproverUnset(this.capabilitiesApprover, "capabilities");
        this.capabilitiesApprover = approver;
    }

    /**
     * Invoke the registered preload approver for the given widget.
     * @returns `true` if the module approved preloading, `false` otherwise.
     */
    public async preapprovePreload(widget: WidgetDescriptor): Promise<boolean> {
        if (!this.preloadApprover) return false;
        try {
            return (await this.preloadApprover(widget)) === true;
        } catch (error) {
            console.error("Widget preload approver failed", error);
            return false;
        }
    }

    /**
     * Invoke the registered identity approver for the given widget.
     * @returns `true` if the module approved the identity token request, `false` otherwise.
     */
    public async preapproveIdentity(widget: WidgetDescriptor): Promise<boolean> {
        if (!this.identityApprover) return false;
        try {
            return (await this.identityApprover(widget)) === true;
        } catch (error) {
            console.error("Widget identity approver failed", error);
            return false;
        }
    }

    /**
     * Invoke the registered capabilities approver for the given widget.
     * @returns The set of approved capabilities, or `undefined` to defer to the default consent flow.
     */
    public async preapproveCapabilities(
        widget: WidgetDescriptor,
        requestedCapabilities: Set<string>,
    ): Promise<Set<string> | undefined> {
        if (!this.capabilitiesApprover) return undefined;
        try {
            return await this.capabilitiesApprover(widget, requestedCapabilities);
        } catch (error) {
            console.error("Widget capabilities approver failed", error);
            return undefined;
        }
    }
}
