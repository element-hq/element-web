/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { type Api } from "@element-hq/element-web-module-api";

import RestrictedGuestsModule from "./index";
import { CONFIG_KEY } from "./config";
import Translations from "./translations.json";

const makeApi = (config: unknown, appConfig: Record<string, unknown> = {}): Api => {
    return {
        config: {
            // With a key, return the module config. Without, return the whole app config.
            get: vi.fn((key?: string) => (key === CONFIG_KEY ? config : appConfig)),
        },
        i18n: {
            register: vi.fn(),
        },
        customComponents: {
            registerRoomPreviewBar: vi.fn(),
            registerLoginComponent: vi.fn(),
        },
        customisations: {
            registerShouldShowComponent: vi.fn(),
        },
        extras: {
            addRoomSummaryCardActionCallback: vi.fn(),
            addMemberListHeaderActionCallback: vi.fn(),
        },
    } as unknown as Api;
};

const validConfig = { guest_user_homeserver_url: "https://guest.example.org" };

describe("RestrictedGuestsModule", () => {
    describe("load", () => {
        it("should do nothing if no config present", async () => {
            const api = makeApi(null);

            const module = new RestrictedGuestsModule(api);
            await module.load();

            expect(api.i18n.register).not.toHaveBeenCalled();
            expect(api.customComponents.registerRoomPreviewBar).not.toHaveBeenCalled();
            expect(api.extras.addRoomSummaryCardActionCallback).not.toHaveBeenCalled();
        });

        it("should register the translations, components and email invitation with a valid config", async () => {
            const api = makeApi(validConfig);

            const module = new RestrictedGuestsModule(api);
            await module.load();

            expect(api.i18n.register).toHaveBeenCalledWith(Translations);
            expect(api.customComponents.registerRoomPreviewBar).toHaveBeenCalled();
            expect(api.customComponents.registerLoginComponent).toHaveBeenCalled();
            expect(api.customisations.registerShouldShowComponent).toHaveBeenCalledWith(module.shouldShowComponent);
            // The email invitation adds the "Invite guests" action to the room info and the member list
            expect(api.extras.addRoomSummaryCardActionCallback).toHaveBeenCalled();
            expect(api.extras.addMemberListHeaderActionCallback).toHaveBeenCalled();
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
            const api = makeApi(validConfig, appConfig);

            const module = new RestrictedGuestsModule(api);
            await module.load();

            expect(appConfig.sso_redirect_options.immediate).toBe(false);
        });
    });
});
