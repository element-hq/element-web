/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ComponentProps } from "react";
import { screen, render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { MatrixWidgetType } from "matrix-widget-api";
import {
    type ApprovalOpts,
    type WidgetInfo,
    WidgetLifecycle,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";

import { WidgetContextMenu } from "../../../../../src/components/views/context_menus/WidgetContextMenu";
import { type IApp } from "../../../../../src/stores/WidgetStore";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import WidgetUtils from "../../../../../src/utils/WidgetUtils";
import { ModuleRunner } from "../../../../../src/modules/ModuleRunner";
import SettingsStore from "../../../../../src/settings/SettingsStore";

describe("<WidgetContextMenu />", () => {
    const widgetId = "w1";
    const eventId = "e1";
    const roomId = "r1";
    const userId = "@user-id:server";

    const app: IApp = {
        id: widgetId,
        eventId,
        roomId,
        type: MatrixWidgetType.Custom,
        url: "https://example.com",
        name: "Example 1",
        creatorUserId: userId,
        avatar_url: undefined,
    };

    let mockClient: MatrixClient;

    let onFinished: () => void;

    beforeEach(() => {
        onFinished = jest.fn();
        jest.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);

        mockClient = {
            getUserId: jest.fn().mockReturnValue(userId),
        } as unknown as MatrixClient;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function getComponent(props: Partial<ComponentProps<typeof WidgetContextMenu>> = {}): JSX.Element {
        return (
            <MatrixClientContext.Provider value={mockClient}>
                <WidgetContextMenu app={app} onFinished={onFinished} {...props} />
            </MatrixClientContext.Provider>
        );
    }

    it("renders revoke button", async () => {
        const { rerender } = render(getComponent());

        const revokeButton = screen.getByLabelText("Revoke permissions");
        expect(revokeButton).toBeInTheDocument();

        jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts, widgetInfo) => {
            if (lifecycleEvent === WidgetLifecycle.PreLoadRequest && (widgetInfo as WidgetInfo).id === widgetId) {
                (opts as ApprovalOpts).approved = true;
            }
        });

        rerender(getComponent());
        expect(revokeButton).not.toBeInTheDocument();
    });

    it("revokes permissions", async () => {
        render(getComponent());
        await userEvent.click(screen.getByLabelText("Revoke permissions"));
        expect(onFinished).toHaveBeenCalled();
        expect(SettingsStore.getValue("allowedWidgets", roomId)[eventId]).toBe(false);
    });
});
