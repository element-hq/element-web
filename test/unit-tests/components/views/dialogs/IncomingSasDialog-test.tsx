/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, render } from "jest-matrix-react";
import React from "react";
import { type Mocked } from "jest-mock";
import {
    type EmojiMapping,
    type ShowSasCallbacks,
    type Verifier,
    VerifierEvent,
    type VerifierEventHandlerMap,
} from "matrix-js-sdk/src/crypto-api";
import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import IncomingSasDialog from "../../../../../src/components/views/dialogs/IncomingSasDialog";
import { stubClient } from "../../../../test-utils";

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
