/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { act, render } from "@testing-library/react";
import React from "react";
import { Mocked } from "jest-mock";
import {
    EmojiMapping,
    ShowSasCallbacks,
    Verifier,
    VerifierEvent,
    VerifierEventHandlerMap,
} from "matrix-js-sdk/src/crypto-api/verification";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import IncomingSasDialog from "../../../../src/components/views/dialogs/IncomingSasDialog";
import { stubClient } from "../../../test-utils";

describe("IncomingSasDialog", () => {
    beforeEach(() => {
        stubClient();
    });

    it("shows a spinner at first", () => {
        const mockVerifier = makeMockVerifier();
        const { container } = renderComponent(mockVerifier);
        expect(container.getElementsByClassName("mx_Spinner").length).toBeTruthy();
    });

    it("should show some emojis once keys are exchanged", () => {
        const mockVerifier = makeMockVerifier();
        const { container } = renderComponent(mockVerifier);

        // fire the ShowSas event
        const sasEvent = makeMockSasCallbacks();
        act(() => {
            mockVerifier.emit(VerifierEvent.ShowSas, sasEvent);
        });

        const emojis = container.getElementsByClassName("mx_VerificationShowSas_emojiSas_block");
        expect(emojis.length).toEqual(7);
        for (const emoji of emojis) {
            expect(emoji).toHaveTextContent("🦄Unicorn");
        }
    });
});

function renderComponent(verifier: Verifier, onFinished = () => true) {
    return render(<IncomingSasDialog verifier={verifier} onFinished={onFinished} />);
}

function makeMockVerifier(): Mocked<Verifier> {
    const verifier = new TypedEventEmitter<VerifierEvent, VerifierEventHandlerMap>();
    Object.assign(verifier, {
        cancel: jest.fn(),
    });
    return verifier as unknown as Mocked<Verifier>;
}

function makeMockSasCallbacks(): ShowSasCallbacks {
    const unicorn: EmojiMapping = ["🦄", "unicorn"];
    return {
        sas: {
            emoji: new Array<EmojiMapping>(7).fill(unicorn),
        },
        cancel: jest.fn(),
        confirm: jest.fn(),
        mismatch: jest.fn(),
    };
}
