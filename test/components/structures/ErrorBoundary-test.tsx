/*
    Copyright 2024 Verji Tech AS. All rights reserved.
    Unauthorized copying or distribution of this file, via any medium, is strictly prohibited.
*/

import React from "react";
import { render, screen } from "@testing-library/react";
import {
    CustomComponentLifecycle,
    CustomComponentOpts,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/CustomComponentLifecycle";

import ErrorBoundary from "../../../src/components/views/elements/ErrorBoundary";
import { ModuleRunner } from "../../../src/modules/ModuleRunner";

describe("ErrorBoundary", () => {
    const renderComp = () => {
        render(
            <ErrorBoundary>
                <div>🤘</div>
            </ErrorBoundary>,
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should render", () => {
        renderComp();
        expect(screen.getByText("🤘")).toBeDefined();
    });

    describe("wrap the ErrorBoundary with a React.Fragment", () => {
        it("should wrap the ErrorBoundary with a React.Fragment", () => {
            jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts) => {
                if (lifecycleEvent === CustomComponentLifecycle.ErrorBoundary) {
                    (opts as CustomComponentOpts).CustomComponent = ({ children }) => {
                        return (
                            <>
                                <div data-testid="wrapper-header">Header</div>
                                <div data-testid="wrapper-ErrorBoundary">{children}</div>
                                <div data-testid="wrapper-footer">Footer</div>
                            </>
                        );
                    };
                }
            });

            renderComp();
            expect(screen.getByTestId("wrapper-header")).toBeDefined();
            expect(screen.getByTestId("wrapper-ErrorBoundary")).toBeDefined();
            expect(screen.getByTestId("wrapper-footer")).toBeDefined();
            expect(screen.getByTestId("wrapper-header").nextSibling).toBe(screen.getByTestId("wrapper-ErrorBoundary"));
            expect(screen.getByTestId("wrapper-ErrorBoundary").nextSibling).toBe(screen.getByTestId("wrapper-footer"));
        });
    });
});
