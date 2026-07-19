/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type I18nApi, type WidgetApi } from "@element-hq/element-web-module-api";
import { type IWidget } from "matrix-widget-api";
import { vi } from "vitest";

export function mockWidget(overrides: Partial<IWidget> = {}): IWidget {
    return {
        id: "widget-1",
        creatorUserId: "@user:example.com",
        type: "m.custom",
        name: "My Widget",
        url: "https://example.com",
        ...overrides,
    };
}

export function mockWidgetApi(overrides: Partial<WidgetApi> = {}): WidgetApi {
    return {
        getWidgetsInRoom: vi.fn().mockReturnValue([]),
        getAppAvatarUrl: vi.fn().mockReturnValue(null),
        isAppInContainer: vi.fn().mockReturnValue(false),
        moveAppToContainer: vi.fn(),
        ...overrides,
    } as unknown as WidgetApi;
}

export function mockI18nApi(): I18nApi {
    return {
        translate: vi.fn().mockImplementation((key: string, vars?: Record<string, string>) => {
            let result = key;
            if (vars) {
                for (const [k, v] of Object.entries(vars)) {
                    result = result.replace(`%(${k})s`, v);
                }
            }
            return result;
        }),
    } as unknown as I18nApi;
}
