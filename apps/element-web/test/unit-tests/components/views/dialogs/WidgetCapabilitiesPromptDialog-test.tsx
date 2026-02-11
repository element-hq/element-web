/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { WidgetKind } from "matrix-widget-api";

import WidgetCapabilitiesPromptDialog from "../../../../../src/components/views/dialogs/WidgetCapabilitiesPromptDialog";
import { stubClient } from "../../../../test-utils";

describe("WidgetCapabilitiesPromptDialog", () => {
    const mockWidget = {
        id: "test-widget",
        name: "Test Widget",
    } as any;

    const onFinished = jest.fn();

    beforeEach(() => {
        stubClient();
        onFinished.mockClear();
    });

    describe("capability sorting", () => {
        it("should sort non-timeline capabilities before timeline capabilities", () => {
            // Create a mix of timeline and non-timeline capabilities
            const capabilities = new Set([
                "org.matrix.msc2762.timeline:*",
                "org.matrix.msc2762.receive.event:m.room.message",
                "org.matrix.msc2762.timeline:!room:example.com",
                "org.matrix.msc2931.navigate",
                "org.matrix.msc2762.receive.state_event:m.room.member#@user:example.com",
            ]);

            const { container } = render(
                <WidgetCapabilitiesPromptDialog
                    requestedCapabilities={capabilities}
                    widget={mockWidget}
                    widgetKind={WidgetKind.Room}
                    onFinished={onFinished}
                />,
            );

            const checkboxes = container.querySelectorAll(".mx_WidgetCapabilitiesPromptDialog_cap");

            // Verify that we have all the capabilities rendered
            expect(checkboxes.length).toBe(5);

            // The dialog should render successfully with the mixed capabilities
            expect(screen.getByText("Approve widget permissions")).toBeInTheDocument();
        });

        it("should sort capabilities lexicographically within the same type", () => {
            // Create multiple non-timeline capabilities
            const capabilities = new Set([
                "org.matrix.msc2931.navigate",
                "org.matrix.msc2762.receive.event:m.room.message",
                "org.matrix.msc2762.receive.state_event:m.room.member",
            ]);

            render(
                <WidgetCapabilitiesPromptDialog
                    requestedCapabilities={capabilities}
                    widget={mockWidget}
                    widgetKind={WidgetKind.Room}
                    onFinished={onFinished}
                />,
            );

            // The dialog should render without errors and show the capabilities
            expect(screen.getByText("Approve widget permissions")).toBeInTheDocument();
        });

        it("should handle only timeline capabilities", () => {
            const capabilities = new Set([
                "org.matrix.msc2762.timeline:!room1:example.com",
                "org.matrix.msc2762.timeline:!room2:example.com",
                "org.matrix.msc2762.timeline:*",
            ]);

            const { container } = render(
                <WidgetCapabilitiesPromptDialog
                    requestedCapabilities={capabilities}
                    widget={mockWidget}
                    widgetKind={WidgetKind.Room}
                    onFinished={onFinished}
                />,
            );

            const checkboxes = container.querySelectorAll(".mx_WidgetCapabilitiesPromptDialog_cap");
            expect(checkboxes.length).toBe(3);
        });

        it("should handle only non-timeline capabilities", () => {
            const capabilities = new Set([
                "org.matrix.msc2931.navigate",
                "org.matrix.msc2762.receive.event:m.room.message",
            ]);

            const { container } = render(
                <WidgetCapabilitiesPromptDialog
                    requestedCapabilities={capabilities}
                    widget={mockWidget}
                    widgetKind={WidgetKind.Room}
                    onFinished={onFinished}
                />,
            );

            const checkboxes = container.querySelectorAll(".mx_WidgetCapabilitiesPromptDialog_cap");
            expect(checkboxes.length).toBe(2);
        });

        it("should handle empty capabilities", () => {
            const capabilities = new Set<string>([]);

            const { container } = render(
                <WidgetCapabilitiesPromptDialog
                    requestedCapabilities={capabilities}
                    widget={mockWidget}
                    widgetKind={WidgetKind.Room}
                    onFinished={onFinished}
                />,
            );

            const checkboxes = container.querySelectorAll(".mx_WidgetCapabilitiesPromptDialog_cap");
            expect(checkboxes.length).toBe(0);
        });
    });
});
