/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TextInputField } from "@matrix-org/react-sdk-module-api/lib/components/TextInputField";
import { Spinner as ModuleSpinner } from "@matrix-org/react-sdk-module-api/lib/components/Spinner";
import React, { type ChangeEvent } from "react";

import Field from "../components/views/elements/Field";
import Spinner from "../components/views/elements/Spinner";

// Here we define all the render factories for the module API components. This file should be
// imported by the ModuleRunner to load them into the call stack at runtime.
//
// If a new component is added to the module API, it should be added here too.
//
// Don't forget to add a test to ensure the renderFactory is overridden! See ModuleComponents-test.tsx

TextInputField.renderFactory = (props) => (
    <Field
        type="text"
        value={props.value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(e.target.value)}
        label={props.label}
        autoComplete="off"
    />
);
ModuleSpinner.renderFactory = () => <Spinner />;
