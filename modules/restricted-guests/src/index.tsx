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
import { initEmailInvitation } from "./email-invitation/index.ts";
import { GuestBadge } from "./GuestBadge.tsx";
import { isGuest } from "./isGuest.ts";

const GUEST_INVISIBLE_COMPONENTS: UIComponent[] = [
    UIComponent.InviteUsers,
    UIComponent.CreateRooms,
    UIComponent.CreateSpaces,
    UIComponent.ExploreRooms,
    UIComponent.RoomOptionsMenu,
    UIComponent.AddIntegrations,
];

class RestrictedGuestsModule implements Module {
    public static readonly moduleApiVersion = "^2.2.0";

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

        // const appConfig = this.api.config.get();
        //  if (appConfig.sso_redirect_options?.immediate) {
        //      console.warn(`${ModuleName} found incompatible option 'sso_redirect_options.immediate', turning it off.`);
        //      appConfig.sso_redirect_options.immediate = false;
        //  }

        // Room preview bar customisations (for Matrix guest support)
        this.api.customComponents.registerRoomPreviewBar((props, OriginalComponent) => (
            <RoomPreviewBar {...props} api={this.api} config={this.config!}>
                <OriginalComponent {...props} />
            </RoomPreviewBar>
        ));
        this.api.customisations.registerShouldShowComponent(this.shouldShowComponent);

        // Show a "Guest" badge next to the names of restricted guests
        this.api.customComponents.registerSenderProfileBadge(({ userId }) =>
            this.config && userId.startsWith(this.config.guest_user_prefix) ? (
                <GuestBadge label={this.api.i18n.translate("guest_badge")} />
            ) : null,
        );

        // Login component customisations (for no guest support)
        this.api.customComponents.registerLoginComponent((props, OriginalComponent) => (
            <OriginalComponent {...props}>
                <AuthFooter onLoggedIn={props.onLoggedIn} api={this.api} config={this.config!} />
            </OriginalComponent>
        ));

        // Register the email invitation feature (for inviting guests to rooms via email)
        initEmailInvitation(this.api, this.config);

        // Guests opening or joining a room with an ongoing call land in the call lobby
        this.api.customisations.registerShouldViewOngoingCall(this.shouldViewOngoingCall);
    }

    /**
     * Returns true, if the `userId` should see the `component`.
     *
     * @param component - the name of the component that is checked
     * @returns true, if the user should see the component
     */
    public readonly shouldShowComponent = (component: UIComponent): boolean => {
        if (this.config && isGuest(this.api, this.config)) {
            return !GUEST_INVISIBLE_COMPONENTS.includes(component);
        }

        return true;
    };

    /**
     * Returns true for guests, so that they land in the call lobby of a room with an ongoing call.
     * Returns undefined otherwise, to let Element Web or other modules decide.
     */
    public readonly shouldViewOngoingCall = (): true | undefined => {
        return (this.config && isGuest(this.api, this.config)) || undefined;
    };
}

export default RestrictedGuestsModule satisfies ModuleFactory;
