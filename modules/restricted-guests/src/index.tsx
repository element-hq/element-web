/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { UIComponent, type Module, type Api, type ModuleFactory } from "@element-hq/element-web-module-api";
import Translations from "./translations.json";
import { ModuleConfig, CONFIG_KEY } from "./config";
import { name as ModuleName } from "../package.json";
import RoomPreviewBar from "./RoomPreviewBar.tsx";
import AuthFooter from "./AuthFooter.tsx";
import style from "./style.css" with { type: "css" };

const GUEST_INVISIBLE_COMPONENTS: UIComponent[] = [
    UIComponent.InviteUsers,
    UIComponent.CreateRooms,
    UIComponent.CreateSpaces,
    UIComponent.ExploreRooms,
    UIComponent.RoomOptionsMenu,
    UIComponent.AddIntegrations,
];

class RestrictedGuestsModule implements Module {
    public static readonly moduleApiVersion = "^1.0.0 || ^2.0.0";

    private config?: ModuleConfig;

    public constructor(private api: Api) {}

    public async load(): Promise<void> {
        const rawConfig = this.api.config.get(CONFIG_KEY);
        if (!rawConfig) {
            console.debug(`No configuration found for module "${ModuleName}", skipping initialization.`);
            return;
        }

        document.adoptedStyleSheets.push(style);

        this.api.i18n.register(Translations);

        try {
            this.config = ModuleConfig.parse(rawConfig);
        } catch (e) {
            console.error("Failed to init module", e);
            throw new Error(`Errors in module configuration for "${ModuleName}"`);
        }

        const appConfig = this.api.config.get();
        if (appConfig.sso_redirect_options?.immediate) {
            console.warn(`${ModuleName} found incompatible option 'sso_redirect_options.immediate', turning it off.`);
            appConfig.sso_redirect_options.immediate = false;
        }

        // Room preview bar customisations (for Matrix guest support)
        this.api.customComponents.registerRoomPreviewBar((props, OriginalComponent) => (
            <RoomPreviewBar {...props} api={this.api} config={this.config!}>
                <OriginalComponent {...props} />
            </RoomPreviewBar>
        ));
        this.api.customisations.registerShouldShowComponent(this.shouldShowComponent);

        // Login component customisations (for no guest support)
        this.api.customComponents.registerLoginComponent((props, OriginalComponent) => (
            <OriginalComponent {...props}>
                <AuthFooter onLoggedIn={props.onLoggedIn} api={this.api} config={this.config!} />
            </OriginalComponent>
        ));
    }

    /**
     * Returns true, if the `userId` should see the `component`.
     *
     * @param component - the name of the component that is checked
     * @returns true, if the user should see the component
     */
    public readonly shouldShowComponent = (component: UIComponent): boolean => {
        const profile = this.api.profile.value;
        if (this.config && (profile.isGuest || profile.userId?.startsWith(this.config.guest_user_prefix))) {
            return !GUEST_INVISIBLE_COMPONENTS.includes(component);
        }

        return true;
    };
}

export default RestrictedGuestsModule satisfies ModuleFactory;
