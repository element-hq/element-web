/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentType, type JSX, useCallback } from "react";
import { type DialogProps, type DialogOptions, type DialogHandle } from "@element-hq/element-web-module-api";

import Modal from "../Modal";
import BaseDialog from "../components/views/dialogs/BaseDialog.tsx";

const OuterDialog = <M, P extends object>({
    title,
    Dialog,
    props,
    onFinished,
}: {
    title: string;
    Dialog: ComponentType<DialogProps<M> & P>;
    props: P;
    onFinished(ok: boolean, model: M | null): void;
}): JSX.Element => {
    const close = useCallback(() => onFinished(false, null), [onFinished]);
    const submit = useCallback((model: M) => onFinished(true, model), [onFinished]);
    return (
        <BaseDialog onFinished={close} title={title}>
            <Dialog {...props} onSubmit={submit} onCancel={close} />
        </BaseDialog>
    );
};

export function openDialog<M, P extends object>(
    initialOptions: DialogOptions,
    Dialog: ComponentType<P & DialogProps<M>>,
    props: P,
): DialogHandle<M> {
    const { close, finished } = Modal.createDialog(OuterDialog<M, P>, {
        title: initialOptions.title,
        Dialog,
        props,
    });

    return {
        finished: finished.then(([ok, model]) => ({
            ok: ok ?? false,
            model: model ?? null,
        })),
        close: () => close(false, null),
    };
}
