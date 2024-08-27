/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { MatrixClient, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { render } from "@testing-library/react";

import { stubClient } from "../../../test-utils";
import AppsDrawer from "../../../../src/components/views/rooms/AppsDrawer";
import SdkConfig from "../../../../src/SdkConfig";
import ResizeNotifier from "../../../../src/utils/ResizeNotifier";
import { WidgetLayoutStore } from "../../../../src/stores/widgets/WidgetLayoutStore";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";

const ROOM_ID = "!room:id";

describe("AppsDrawer", () => {
    let client: MatrixClient;
    let room: Room;
    let dummyResizeNotifier: ResizeNotifier;

    beforeEach(async () => {
        client = stubClient();
        room = new Room(ROOM_ID, client, client.getUserId()!, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        dummyResizeNotifier = new ResizeNotifier();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("honours default_widget_container_height", () => {
        jest.spyOn(SdkConfig, "get").mockImplementation((key) => {
            if (!key) {
                return {
                    default_widget_container_height: 500,
                };
            }
        });
        jest.spyOn(WidgetLayoutStore.instance, "getContainerWidgets").mockImplementation((room, container) => {
            if (container === "top") {
                return [
                    {
                        id: "testwidget",
                        creatorUserId: client.getUserId()!,
                        type: "test",
                        url: "https://nowhere.dummy/notawidget",
                    },
                ];
            }
            return [];
        });

        const { container } = render(
            <AppsDrawer
                userId={client.getUserId()!}
                room={room}
                resizeNotifier={dummyResizeNotifier}
                showApps={true}
            />,
            {
                wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
            },
        );

        const appsDrawerResizer = container.getElementsByClassName("mx_AppsDrawer_resizer")[0] as HTMLElement;
        expect(appsDrawerResizer.style.height).toBe("500px");
    });
});
