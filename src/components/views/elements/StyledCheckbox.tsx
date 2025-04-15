/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useId, type ReactNode, type Ref } from "react";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";
import { CheckboxInput, Form, HelpMessage, InlineField, Label } from "@vector-im/compound-web";

interface IProps extends React.InputHTMLAttributes<HTMLInputElement> {
    inputRef?: Ref<HTMLInputElement>;
    id?: string;
    description?: ReactNode;
}

const StyledCheckbox: React.FC<IProps> = ({
    id: initialId,
    children: label,
    className,
    inputRef,
    description,
    ...otherProps
}) => {
    const id = initialId || "checkbox_" + secureRandomString(10);
    const name = useId();
    const descriptionId = useId();
    return (
        <Form.Root>
            <InlineField
                className={className}
                name={name}
                control={
                    <CheckboxInput
                        ref={inputRef}
                        aria-describedby={description ? descriptionId : undefined}
                        id={id}
                        {...otherProps}
                    />
                }
            >
                {label && <Label htmlFor={id}>{label}</Label>}
                {description && <HelpMessage id={descriptionId}>{description}</HelpMessage>}
            </InlineField>
        </Form.Root>
    );
};

export default StyledCheckbox;
