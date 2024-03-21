/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { RenderResult, render } from "@testing-library/react";
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import MKeyVerificationRequest from "../../../../src/components/views/messages/MKeyVerificationRequest";
import TileErrorBoundary from "../../../../src/components/views/messages/TileErrorBoundary";
import { Layout } from "../../../../src/settings/enums/Layout";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { filterConsole } from "../../../test-utils";

describe("MKeyVerificationRequest", () => {
    filterConsole(
        "The above error occurred in the <MKeyVerificationRequest> component",
        "Error: Attempting to render verification request without a client context!",
        "Error: Verification request did not include a sender!",
        "Error: Verification request did not include a room ID!",
    );

    it("shows an error if not wrapped in a client context", () => {
        const event = new MatrixEvent({ type: "m.key.verification.request" });
        const { container } = renderEventNoClient(event);
        expect(container).toHaveTextContent("Can't load this message");
    });

    it("shows an error if the event has no sender", () => {
        const { client } = setup();
        const event = new MatrixEvent({ type: "m.key.verification.request" });
        const { container } = renderEvent(client, event);
        expect(container).toHaveTextContent("Can't load this message");
    });

    it("shows an error if the event has no room", () => {
        const { client } = setup();
        const event = new MatrixEvent({ type: "m.key.verification.request", sender: "@a:b.co" });
        const { container } = renderEvent(client, event);
        expect(container).toHaveTextContent("Can't load this message");
    });

    it("displays a request from me", () => {
        const { client, myUserId } = setup();
        const event = new MatrixEvent({ type: "m.key.verification.request", sender: myUserId, room_id: "!x:y.co" });
        const { container } = renderEvent(client, event);
        expect(container).toHaveTextContent("You sent a verification request");
    });

    it("displays a request from someone else to me", () => {
        const otherUserId = "@other:s.uk";
        const { client } = setup();
        const event = new MatrixEvent({ type: "m.key.verification.request", sender: otherUserId, room_id: "!x:y.co" });
        const { container } = renderEvent(client, event);
        expect(container).toHaveTextContent("other:s.uk wants to verify");
    });
});

function renderEventNoClient(event: MatrixEvent): RenderResult {
    return render(
        <TileErrorBoundary mxEvent={event} layout={Layout.Group}>
            <MKeyVerificationRequest mxEvent={event} />
        </TileErrorBoundary>,
    );
}

function renderEvent(client: MatrixClient, event: MatrixEvent): RenderResult {
    return render(
        <TileErrorBoundary mxEvent={event} layout={Layout.Group}>
            <MatrixClientContext.Provider value={client}>
                <MKeyVerificationRequest mxEvent={event} />
            </MatrixClientContext.Provider>
            ,
        </TileErrorBoundary>,
    );
}

function setup(): { client: MatrixClient; myUserId: string } {
    const myUserId = "@me:s.co";

    const client = {
        getSafeUserId: jest.fn().mockReturnValue(myUserId),
        getRoom: jest.fn(),
    } as unknown as MatrixClient;

    return { client, myUserId };
}
