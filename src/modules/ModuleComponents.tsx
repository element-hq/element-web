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

import { TextInputField } from "@matrix-org/react-sdk-module-api/lib/components/TextInputField";
import { Spinner as ModuleSpinner } from "@matrix-org/react-sdk-module-api/lib/components/Spinner";
import React, { ChangeEvent } from "react";

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
