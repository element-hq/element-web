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

import EntityTile from "../../../src/components/views/rooms/EntityTile";
import { ModuleRunner } from "../../../src/modules/ModuleRunner";

describe("EntityTile", () => {
    const renderComp = () => {
        render(<EntityTile />);
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should render", () => {
        renderComp();
        expect(screen.getByTestId("avatar-img")).toBeDefined();
    });

    describe("wrap the EntityTile with a React.Fragment", () => {
        it("should wrap the EntityTile with a React.Fragment", () => {
            jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts) => {
                if (lifecycleEvent === CustomComponentLifecycle.EntityTile) {
                    (opts as CustomComponentOpts).CustomComponent = ({ children }) => {
                        return (
                            <>
                                <div data-testid="wrapper-header">Header</div>
                                <div data-testid="wrapper-EntityTile">{children}</div>
                                <div data-testid="wrapper-footer">Footer</div>
                            </>
                        );
                    };
                }
            });

            renderComp();
            expect(screen.getByTestId("wrapper-header")).toBeDefined();
            expect(screen.getByTestId("wrapper-EntityTile")).toBeDefined();
            expect(screen.getByTestId("wrapper-footer")).toBeDefined();
            expect(screen.getByTestId("wrapper-header").nextSibling).toBe(screen.getByTestId("wrapper-EntityTile"));
            expect(screen.getByTestId("wrapper-EntityTile").nextSibling).toBe(screen.getByTestId("wrapper-footer"));
        });
    });
});
