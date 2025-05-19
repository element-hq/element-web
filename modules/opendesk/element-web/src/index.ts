/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import NordeckOpendeskModule from "@nordeck/element-web-opendesk-module";
import GuestModule, {
    assertValidGuestModuleConfig,
    GUEST_MODULE_CONFIG_KEY,
    GUEST_MODULE_CONFIG_NAMESPACE,
    shouldShowComponent as shouldShowComponentShared,
} from "@nordeck/element-web-guest-module";
import WidgetLifecycleModule from "@nordeck/element-web-widget-lifecycle-module";
import WidgetTogglesModule from "@nordeck/element-web-widget-toggles-module";

import type { Module, Api, ModuleFactory } from "@element-hq/element-web-module-api";

declare module "@element-hq/element-web-module-api" {
    interface Config {
        [GUEST_MODULE_CONFIG_NAMESPACE]: {
            [GUEST_MODULE_CONFIG_KEY]: {
                guest_user_homeserver_url: string;
                skip_single_sign_on?: boolean;
                guest_user_prefix?: string;
            };
        };
    }
}

declare global {
    interface Window {
        // XXX: temporary hack until we rewrite everything in modern modules
        mxMatrixClientPeg: {
            safeGet(): {
                getSafeUserId(): string;
            };
        };
    }
}

class OpendeskModule implements Module {
    public static readonly moduleApiVersion = "^1.0.0";

    public constructor(private api: Api) {}

    public async load(): Promise<void> {
        const { api } = this;

        api._registerLegacyModule(NordeckOpendeskModule);
        api._registerLegacyModule(GuestModule);
        api._registerLegacyModule(WidgetLifecycleModule);
        api._registerLegacyModule(WidgetTogglesModule);
        api._registerLegacyComponentVisibilityCustomisations({
            // XXX: the following is cribbed out of `@nordeck/element-web-guest-module` due to
            // it making imports incompatible with workspaces
            /**
             * Determines whether or not the active MatrixClient user should be able to use
             * the given UI component. If shown, the user might still not be able to use the
             * component depending on their contextual permissions. For example, invite options
             * might be shown to the user but they won't have permission to invite users to
             * the current room: the button will appear disabled.
             * @param {UIComponent} component The component to check visibility for.
             * @returns {boolean} True (default) if the user is able to see the component, false
             * otherwise.
             */
            shouldShowComponent(component): boolean {
                const config = api.config.get(GUEST_MODULE_CONFIG_NAMESPACE)?.[GUEST_MODULE_CONFIG_KEY] ?? {};
                assertValidGuestModuleConfig(config);

                const myUserId = window.mxMatrixClientPeg.safeGet().getSafeUserId();
                return shouldShowComponentShared(config, myUserId, component);
            },
        });
    }
}

export default OpendeskModule satisfies ModuleFactory;
