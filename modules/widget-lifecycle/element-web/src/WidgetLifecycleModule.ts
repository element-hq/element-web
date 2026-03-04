/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Api, Module, WidgetDescriptor, WidgetLifecycleApi } from "@element-hq/element-web-module-api";
import { CONFIG_KEY, parseWidgetLifecycleConfig, type WidgetLifecycleModuleConfig } from "./config";
import { constructWidgetPermissions } from "./utils/constructWidgetPermissions";
import { matchPattern } from "./utils/matchPattern";

/** Subset of {@link WidgetLifecycleApi} used by the module for registration only. */
export type WidgetLifecycleApiAdapter = Pick<
    WidgetLifecycleApi,
    "registerPreloadApprover" | "registerIdentityApprover" | "registerCapabilitiesApprover"
>;

type ModuleApi = Pick<Api, "config" | "widgetLifecycle">;

/**
 * Module that auto-approves widget preloading, identity token requests, and capability
 * requests based on URL-pattern rules defined in config.json.
 */
export default class WidgetLifecycleModule implements Module {
    public static readonly moduleApiVersion = "^1.0.0";

    private config: WidgetLifecycleModuleConfig = {};

    public constructor(private api: ModuleApi) {}

    public async load(): Promise<void> {
        if (!this.api.widgetLifecycle?.registerPreloadApprover) {
            throw new Error(
                "Widget lifecycle API is not available. Update Element Web to a build that provides widget lifecycle module support.",
            );
        }

        try {
            this.config = parseWidgetLifecycleConfig(this.api.config.get(CONFIG_KEY));
        } catch (error) {
            console.error("[WidgetLifecycle] Failed to init module", error);
            this.config = {};
        }

        this.api.widgetLifecycle.registerPreloadApprover((widget) => this.preapprovePreload(widget));
        this.api.widgetLifecycle.registerIdentityApprover((widget) => this.preapproveIdentity(widget));
        this.api.widgetLifecycle.registerCapabilitiesApprover((widget, requested) =>
            this.preapproveCapabilities(widget, requested),
        );
    }

    private preapprovePreload(widget: WidgetDescriptor): boolean {
        const configuration = constructWidgetPermissions(this.config, widget.templateUrl);
        return configuration.preload_approved === true;
    }

    private preapproveIdentity(widget: WidgetDescriptor): boolean {
        const configuration = constructWidgetPermissions(this.config, widget.templateUrl);
        return configuration.identity_approved === true;
    }

    private preapproveCapabilities(
        widget: WidgetDescriptor,
        requestedCapabilities: Set<string>,
    ): Set<string> | undefined {
        const configuration = constructWidgetPermissions(this.config, widget.templateUrl);
        const capabilitiesApproved = configuration.capabilities_approved;

        if (!capabilitiesApproved) return undefined;

        const approvedCapabilities = new Set<string>();
        for (const requestedCapability of requestedCapabilities) {
            if (capabilitiesApproved.some((capability) => matchPattern(requestedCapability, capability))) {
                approvedCapabilities.add(requestedCapability);
            }
        }

        return approvedCapabilities.size > 0 ? approvedCapabilities : undefined;
    }
}

export { WidgetLifecycleModule };
