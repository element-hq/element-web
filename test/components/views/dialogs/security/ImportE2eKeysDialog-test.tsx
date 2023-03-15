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

import React from "react";
import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ImportE2eKeysDialog from "../../../../../src/async-components/views/dialogs/security/ImportE2eKeysDialog";
import { createTestClient } from "../../../../test-utils";

describe("ImportE2eKeysDialog", () => {
    it("renders", () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const { asFragment } = render(<ImportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should have disabled submit button initially", () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const { container } = render(<ImportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        expect(container.querySelector("[type=submit]")!).toBeDisabled();
    });

    it("should enable submit once file is uploaded and passphrase typed in", () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const file = new File(["test"], "file.txt", { type: "text/plain" });

        const { container } = render(<ImportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        fireEvent.change(container.querySelector("[type=file]")!, {
            target: { files: [file] },
        });
        fireEvent.change(container.querySelector("[type=password]")!, {
            target: { value: "passphrase" },
        });
        expect(container.querySelector("[type=submit]")!).toBeEnabled();
    });

    it("should enable submit once file is uploaded and passphrase pasted in", async () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const file = new File(["test"], "file.txt", { type: "text/plain" });

        const { container } = render(<ImportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        fireEvent.change(container.querySelector("[type=file]")!, {
            target: { files: [file] },
        });
        await userEvent.click(container.querySelector("[type=password]")!);
        await userEvent.paste("passphrase");
        expect(container.querySelector("[type=submit]")!).toBeEnabled();
    });
});
