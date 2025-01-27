/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Module, Api, ModuleFactory } from "@element-hq/element-web-module-api";
import NordeckOpendeskModule from "@nordeck/element-web-opendesk-module";
import GuestModule from "@nordeck/element-web-guest-module";
import WidgetLifecycleModule from "@nordeck/element-web-widget-lifecycle-module";
import WidgetTogglesModule from "@nordeck/element-web-widget-toggles-module";
import { ComponentVisibilityCustomisations } from "@nordeck/element-web-guest-module/customisations/ComponentVisibility";

class OpendeskModule implements Module {
    public static readonly moduleApiVersion = "^0.1.0";

    public constructor(private api: Api) {}

    public async load(): Promise<void> {
        this.api._registerLegacyModule(NordeckOpendeskModule);
        this.api._registerLegacyModule(GuestModule);
        this.api._registerLegacyModule(WidgetLifecycleModule);
        this.api._registerLegacyModule(WidgetTogglesModule);
        this.api._registerLegacyComponentVisibilityCustomisations(ComponentVisibilityCustomisations);
    }
}

export default OpendeskModule satisfies ModuleFactory;
