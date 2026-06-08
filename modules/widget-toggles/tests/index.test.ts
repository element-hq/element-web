/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type Api } from "@element-hq/element-web-module-api";
import { type IWidget } from "matrix-widget-api";

import WidgetToggleModule from "../src/index";
import { CONFIG_KEY, WidgetTogglesConfig } from "../src/config";
import { mockWidget, mockWidgetApi } from "./mocks";

const makeApi = (widgets: IWidget[] = []): Api => {
    const addRoomHeaderButtonCallback = vi.fn();
    return {
        config: {
            get: vi.fn().mockReturnValue({ types: ["m.custom"] }),
        },
        extras: {
            addRoomHeaderButtonCallback,
        },
        widget: mockWidgetApi({
            getWidgetsInRoom: vi.fn().mockReturnValue(widgets),
        }),
        i18n: {
            translate: vi.fn().mockImplementation((key: string) => key),
        },
    } as unknown as Api;
};

vi.mock("../src/config", async () => {
    return {
        CONFIG_KEY: "fake_config_key",
        WidgetTogglesConfig: {
            parse: vi.fn(),
        },
    };
});

describe("WidgetToggleModule", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("load", () => {
        test("reads config using CONFIG_KEY", async () => {
            const api = makeApi();

            const module = new WidgetToggleModule(api);
            await module.load();

            expect(api.config.get).toHaveBeenCalledWith(CONFIG_KEY);
        });

        test("parses config with WidgetTogglesConfig.parse", async () => {
            const api = makeApi();
            const rawConfig = { types: ["m.custom"] };
            (api.config.get as ReturnType<typeof vi.fn>).mockReturnValue(rawConfig);

            const module = new WidgetToggleModule(api);
            await module.load();

            expect(WidgetTogglesConfig.parse).toHaveBeenCalledWith(rawConfig);
        });

        test("registers a room header button callback", async () => {
            const api = makeApi();
            (WidgetTogglesConfig.parse as ReturnType<typeof vi.fn>).mockReturnValue({ types: ["m.custom"] });

            const module = new WidgetToggleModule(api);
            await module.load();

            expect(api.extras.addRoomHeaderButtonCallback).toHaveBeenCalledOnce();
        });

        test("throws error when config parsing fails", async () => {
            const api = makeApi();
            (WidgetTogglesConfig.parse as ReturnType<typeof vi.fn>).mockImplementation(() => {
                throw new Error("Invalid config");
            });

            const module = new WidgetToggleModule(api);
            await expect(module.load()).rejects.toThrow("Errors in module configuration for widget toggles module");
        });
    });

    describe("room header button callback", () => {
        const roomId = "!room:example.com";

        const getCallback = async (api: Api): Promise<(roomId: string) => React.JSX.Element | undefined> => {
            (WidgetTogglesConfig.parse as ReturnType<typeof vi.fn>).mockReturnValue({ types: ["m.custom"] });
            const module = new WidgetToggleModule(api);
            await module.load();
            return (api.extras.addRoomHeaderButtonCallback as ReturnType<typeof vi.fn>).mock.calls[0][0];
        };

        test("returns undefined when there are no widgets in the room", async () => {
            const api = makeApi([]);
            const callback = await getCallback(api);

            const result = callback(roomId);
            expect(result).toBeUndefined();
        });

        test("returns undefined when no widgets match the configured types", async () => {
            const api = makeApi([mockWidget({ type: "m.other" })]);
            const callback = await getCallback(api);

            const result = callback(roomId);
            expect(result).toBeUndefined();
        });

        test("renders WidgetToggle for each matching widget", async () => {
            const api = makeApi([
                mockWidget({ id: "w1", type: "m.custom", name: "Widget One" }),
                mockWidget({ id: "w2", type: "m.custom", name: "Widget Two" }),
            ]);
            (api.i18n.translate as ReturnType<typeof vi.fn>).mockImplementation(
                (key: string, vars?: Record<string, string>) => {
                    let result = key;
                    if (vars) {
                        for (const [k, v] of Object.entries(vars)) {
                            result = result.replace(`%(${k})s`, v);
                        }
                    }
                    return result;
                },
            );
            const callback = await getCallback(api);

            const result = callback(roomId);
            expect(result).toBeDefined();
            render(result!);

            expect(screen.getAllByRole("button").length).toBe(2);
        });

        test("does not render WidgetToggle for non-matching widget types", async () => {
            const api = makeApi([
                mockWidget({ id: "w1", type: "m.custom", name: "Widget One" }),
                mockWidget({ id: "w2", type: "m.other", name: "Widget Other" }),
            ]);
            (api.i18n.translate as ReturnType<typeof vi.fn>).mockImplementation(
                (key: string, vars?: Record<string, string>) => {
                    let result = key;
                    if (vars) {
                        for (const [k, v] of Object.entries(vars)) {
                            result = result.replace(`%(${k})s`, v);
                        }
                    }
                    return result;
                },
            );
            const callback = await getCallback(api);

            const result = callback(roomId);
            expect(result).toBeDefined();
            render(result!);

            expect(screen.getAllByRole("button").length).toBe(1);
        });

        test("calls getWidgetsInRoom with correct roomId", async () => {
            const api = makeApi([]);
            const callback = await getCallback(api);

            callback(roomId);
            expect(api.widget.getWidgetsInRoom).toHaveBeenCalledWith(roomId);
        });
    });
});
