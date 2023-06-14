/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { ComponentProps } from "react";
import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { MatrixWidgetType } from "matrix-widget-api";
import {
    ApprovalOpts,
    WidgetInfo,
    WidgetLifecycle,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";

import { WidgetContextMenu } from "../../../../src/components/views/context_menus/WidgetContextMenu";
import { IApp } from "../../../../src/stores/WidgetStore";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import WidgetUtils from "../../../../src/utils/WidgetUtils";
import { ModuleRunner } from "../../../../src/modules/ModuleRunner";
import SettingsStore from "../../../../src/settings/SettingsStore";

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

    const mockClient = {
        getUserId: jest.fn().mockReturnValue(userId),
    } as unknown as MatrixClient;

    let onFinished: () => void;

    beforeEach(() => {
        onFinished = jest.fn();
        jest.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);
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
