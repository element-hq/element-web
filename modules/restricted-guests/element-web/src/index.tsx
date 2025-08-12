/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Module, Api, ModuleFactory } from "@element-hq/element-web-module-api";
import Translations from "./translations.json";
import { ModuleConfig, CONFIG_KEY } from "./config";
import { name as ModuleName } from "../package.json";
import RoomPreviewBar from "./RoomPreviewBar.tsx";

const GUEST_INVISIBLE_COMPONENTS = [
    "UIComponent.sendInvites",
    "UIComponent.roomCreation",
    "UIComponent.spaceCreation",
    "UIComponent.exploreRooms",
    "UIComponent.roomOptionsMenu",
    "UIComponent.addIntegrations",
];

class RestrictedGuestsModule implements Module {
    public static readonly moduleApiVersion = "^1.0.0";

    private config?: ModuleConfig;

    public constructor(private api: Api) {}

    public async load(): Promise<void> {
        this.api.i18n.register(Translations);

        try {
            this.config = ModuleConfig.parse(this.api.config.get(CONFIG_KEY));
        } catch (e) {
            console.error("Failed to init module", e);
            throw new Error(`Errors in module configuration for "${ModuleName}"`);
        }

        this.api.customComponents.registerRoomPreviewBar((props, OriginalComponent) => (
            <RoomPreviewBar {...props} api={this.api} config={this.config!}>
                <OriginalComponent {...props} />
            </RoomPreviewBar>
        ));

        // TODO replace this with a more generic API
        this.api._registerLegacyComponentVisibilityCustomisations(this);
    }

    /**
     * Returns true, if the `userId` should see the `component`.
     *
     * @param component - the name of the component that is checked
     * @returns true, if the user should see the component
     */
    public readonly shouldShowComponent = (component: string): boolean => {
        if (!this.config || !this.api.profile.value.userId?.startsWith(this.config.guest_user_prefix)) {
            return true;
        }

        return GUEST_INVISIBLE_COMPONENTS.includes(component);
    };
}

export default RestrictedGuestsModule satisfies ModuleFactory;
