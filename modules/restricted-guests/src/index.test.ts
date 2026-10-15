/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { type Api, UIComponent } from "@element-hq/element-web-module-api";

import RestrictedGuestsModule from "./index";
import { CONFIG_KEY } from "./config";
import Translations from "./translations.json";

const makeApi = (
    config: unknown,
    profile: { isGuest?: boolean; userId?: string } = {},
    appConfig: Record<string, unknown> = {},
): Api => {
    return {
        config: {
            // With a key, return the module config. Without, return the whole app config.
            get: vi.fn((key?: string) => (key === CONFIG_KEY ? config : appConfig)),
        },
        i18n: {
            register: vi.fn(),
            translate: vi.fn((key: string) => key),
        },
        profile: {
            value: profile,
        },
        customComponents: {
            registerRoomPreviewBar: vi.fn(),
            registerLoginComponent: vi.fn(),
            registerSenderProfileBadge: vi.fn(),
        },
        customisations: {
            registerShouldShowComponent: vi.fn(),
            registerShouldViewOngoingCall: vi.fn(),
        },
        extras: {
            addRoomSummaryCardActionCallback: vi.fn(),
            addMemberListHeaderActionCallback: vi.fn(),
        },
    } as unknown as Api;
};

const VALID_CONFIG = { guest_user_homeserver_url: "https://guest.local" };

describe("RestrictedGuestsModule", () => {
    describe("load", () => {
        it("should do nothing if no config present", async () => {
            const api = makeApi(null);

            const module = new RestrictedGuestsModule(api);
            await module.load();

            expect(api.i18n.register).not.toHaveBeenCalled();
            expect(api.customComponents.registerRoomPreviewBar).not.toHaveBeenCalled();
            expect(api.extras.addRoomSummaryCardActionCallback).not.toHaveBeenCalled();
            expect(api.customisations.registerShouldViewOngoingCall).not.toHaveBeenCalled();
        });

        it("should register the translations, components, email invitation and ongoing call view with a valid config", async () => {
            const api = makeApi(VALID_CONFIG);

            const module = new RestrictedGuestsModule(api);
            await module.load();

            expect(api.i18n.register).toHaveBeenCalledWith(Translations);
            expect(api.customComponents.registerRoomPreviewBar).toHaveBeenCalled();
            expect(api.customComponents.registerLoginComponent).toHaveBeenCalled();
            expect(api.customisations.registerShouldShowComponent).toHaveBeenCalledWith(module.shouldShowComponent);
            // The email invitation adds the "Invite guests" action to the room info and the member list
            expect(api.extras.addRoomSummaryCardActionCallback).toHaveBeenCalled();
            expect(api.extras.addMemberListHeaderActionCallback).toHaveBeenCalled();
            expect(api.customisations.registerShouldViewOngoingCall).toHaveBeenCalledWith(module.shouldViewOngoingCall);
        });

        it("should throw on an invalid config", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            const api = makeApi({ guest_user_homeserver_url: "not a url" });

            const module = new RestrictedGuestsModule(api);

            await expect(module.load()).rejects.toThrow("Errors in module configuration");
            expect(api.customComponents.registerRoomPreviewBar).not.toHaveBeenCalled();
        });

        it("should turn off sso_redirect_options.immediate", async () => {
            vi.spyOn(console, "warn").mockImplementation(() => {});
            const appConfig = { sso_redirect_options: { immediate: true } };
            const api = makeApi(VALID_CONFIG, {}, appConfig);

            const module = new RestrictedGuestsModule(api);
            await module.load();

            expect(appConfig.sso_redirect_options.immediate).toBe(false);
        });
    });

    describe("user profile badge", () => {
        it("should show a guest badge only for users with the guest prefix", async () => {
            const api = makeApi(VALID_CONFIG);
            await new RestrictedGuestsModule(api).load();

            const renderBadge = vi.mocked(api.customComponents.registerSenderProfileBadge).mock.calls[0][0];
            expect(renderBadge({ userId: "@guest-jim:server" })?.props.label).toBe("guest_badge");
            expect(renderBadge({ userId: "@alice:server" })).toBeNull();
        });
    });

    describe("shouldShowComponent", () => {
        it("should show all components if no config present", async () => {
            const module = new RestrictedGuestsModule(makeApi(null, { isGuest: true }));
            await module.load();

            expect(module.shouldShowComponent(UIComponent.ExploreRooms)).toBe(true);
        });

        it("should show all components to regular users", async () => {
            const module = new RestrictedGuestsModule(makeApi(VALID_CONFIG, { userId: "@alice:server" }));
            await module.load();

            expect(module.shouldShowComponent(UIComponent.ExploreRooms)).toBe(true);
        });

        it.each([
            ["matrix guest", { isGuest: true }],
            ["user with guest prefix", { userId: "@guest-jim:server" }],
        ])("should hide only restricted components from a %s", async (_, profile) => {
            const module = new RestrictedGuestsModule(makeApi(VALID_CONFIG, profile));
            await module.load();

            expect(module.shouldShowComponent(UIComponent.ExploreRooms)).toBe(false);
            expect(module.shouldShowComponent(UIComponent.FilterContainer)).toBe(true);
        });
    });

    describe("shouldViewOngoingCall", () => {
        it("should land guests in the ongoing call", async () => {
            const module = new RestrictedGuestsModule(makeApi(VALID_CONFIG, { userId: "@guest-jim:server" }));
            await module.load();

            expect(module.shouldViewOngoingCall()).toBe(true);
        });

        it("should let Element Web decide for regular users", async () => {
            const module = new RestrictedGuestsModule(makeApi(VALID_CONFIG, { userId: "@alice:server" }));
            await module.load();

            expect(module.shouldViewOngoingCall()).toBeUndefined();
        });
    });
});
