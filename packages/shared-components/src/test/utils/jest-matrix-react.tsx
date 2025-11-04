/*
Copyright 2025 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Copied from element-web/test/test-utils because, seemingly, if we
// set that as the modules directory to use it directly, it fails to
// actually put the right thing in the context somehow.

import React, { type ReactElement } from "react";
// eslint-disable-next-line no-restricted-imports
import { render, type RenderOptions } from "@testing-library/react";
import { TooltipProvider } from "@vector-im/compound-web";

const wrapWithTooltipProvider = (Wrapper: RenderOptions["wrapper"]) => {
    return ({ children }: { children: React.ReactNode }) => {
        if (Wrapper) {
            return (
                <Wrapper>
                    <TooltipProvider>{children}</TooltipProvider>
                </Wrapper>
            );
        } else {
            return <TooltipProvider>{children}</TooltipProvider>;
        }
    };
};

const customRender = (ui: ReactElement, options: RenderOptions = {}): ReturnType<typeof render> => {
    return render(ui, {
        ...options,
        wrapper: wrapWithTooltipProvider(options?.wrapper) as RenderOptions["wrapper"],
    }) as ReturnType<typeof render>;
};

// eslint-disable-next-line no-restricted-imports
export * from "@testing-library/react";

/**
 * This custom render function wraps your component with a TooltipProvider.
 * See https://testing-library.com/docs/react-testing-library/setup/#custom-render
 */
export { customRender as render };
