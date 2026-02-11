/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";
// eslint-disable-next-line no-restricted-imports
import { render, type RenderOptions } from "@testing-library/react";
import { TooltipProvider } from "@vector-im/compound-web";
import { I18nContext } from "@element-hq/web-shared-components";

/**
 * Wraps the provided components in:
 *  * A TooltipProvider
 *  * An I18nContext.Provider
 *
 * ...plus any wrapper provided in the options.
 * @param Wrapper Additional wrapper to include
 * @returns The wrapped component
 */
const wrapWithStandardContexts = (Wrapper: RenderOptions["wrapper"]) => {
    return ({ children }: { children: React.ReactNode }) => {
        if (Wrapper) {
            return (
                <Wrapper>
                    <I18nContext.Provider value={window.mxModuleApi.i18n}>
                        <TooltipProvider>{children}</TooltipProvider>
                    </I18nContext.Provider>
                </Wrapper>
            );
        } else {
            return (
                <TooltipProvider>
                    <I18nContext.Provider value={window.mxModuleApi.i18n}>{children}</I18nContext.Provider>
                </TooltipProvider>
            );
        }
    };
};

const customRender = (ui: ReactElement, options: RenderOptions = {}) => {
    return render(ui, {
        ...options,
        wrapper: wrapWithStandardContexts(options?.wrapper) as RenderOptions["wrapper"],
    }) as ReturnType<typeof render>;
};

// eslint-disable-next-line no-restricted-imports
export * from "@testing-library/react";

/**
 * This custom render function wraps your component with a TooltipProvider.
 * See https://testing-library.com/docs/react-testing-library/setup/#custom-render
 */
export { customRender as render };
