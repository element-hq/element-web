/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Api, UIComponent } from "@element-hq/element-web-module-api";

import RestrictedGuestsModule from "./index";
import { CONFIG_KEY } from "./config";
import Translations from "./translations.json";

const makeApi = (config: unknown, profile: { isGuest?: boolean; userId?: string } = {}): Api => {
    return {
        config: {
            get: vi.fn((key?: string) => (key ? config : {})),
        },
        i18n: {
            registerLanguage: vi.fn(),
            namespaced: vi.fn().mockReturnThis(),
        },
        profile: {
            value: profile,
        },
        customComponents: {
            registerRoomPreviewBar: vi.fn(),
            registerLoginComponent: vi.fn(),
        },
        customisations: {
            registerShouldShowComponent: vi.fn(),
        },
    } as unknown as Api;
};

const VALID_CONFIG = { guest_user_homeserver_url: "https://guest.local" };

describe("RestrictedGuestsModule", () => {
    beforeEach(() => {
        // load() adopts the module stylesheet, and vitest runs this module in node
        vi.stubGlobal("document", { adoptedStyleSheets: [] });
    });

    describe("load", () => {
        it("should do nothing if no config present", async () => {
            const api = makeApi(null);

            const module = new RestrictedGuestsModule(api);
            await module.load();

            expect(api.i18n.registerLanguage).not.toHaveBeenCalled();
        });

        it("should register translations under the module's config key", async () => {
            const api = makeApi(VALID_CONFIG);

            const module = new RestrictedGuestsModule(api);
            await module.load();

            expect(api.i18n.namespaced).toHaveBeenCalledWith(CONFIG_KEY);
            expect(api.i18n.registerLanguage).toHaveBeenCalledWith("en", Translations.en);
            expect(api.i18n.registerLanguage).toHaveBeenCalledWith("de_DE", Translations.de_DE);
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
            expect(module.shouldShowComponent(UIComponent.ReleaseAnnouncements)).toBe(false);
            expect(module.shouldShowComponent(UIComponent.FilterContainer)).toBe(false);
            expect(module.shouldShowComponent(UIComponent.CreateDM)).toBe(false);
            expect(module.shouldShowComponent(UIComponent.SetUpRecoveryToast)).toBe(false);
            expect(module.shouldShowComponent(UIComponent.NotificationsToast)).toBe(false);
        });
    });
});
