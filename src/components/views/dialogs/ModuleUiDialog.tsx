/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { DialogContent, DialogProps } from "@matrix-org/react-sdk-module-api/lib/components/DialogContent";
import { logger } from "matrix-js-sdk/src/logger";
import { ModuleApi } from "@matrix-org/react-sdk-module-api/lib/ModuleApi";
import { ModuleUiDialogOptions } from "@matrix-org/react-sdk-module-api/lib/types/ModuleUiDialogOptions";

import ScrollableBaseModal, { IScrollableBaseState } from "./ScrollableBaseModal";
import { _t } from "../../../languageHandler";

interface IProps<P extends DialogProps, C extends DialogContent<P>> {
    contentFactory: (props: P, ref: React.RefObject<C>) => React.ReactNode;
    additionalContentProps: Omit<P, keyof DialogProps> | undefined;
    initialOptions: ModuleUiDialogOptions;
    moduleApi: ModuleApi;
    onFinished(ok?: boolean, model?: Awaited<ReturnType<DialogContent<P & DialogProps>["trySubmit"]>>): void;
}

interface IState extends IScrollableBaseState {
    // nothing special
}

export class ModuleUiDialog<P extends DialogProps, C extends DialogContent<P>> extends ScrollableBaseModal<
    IProps<P, C>,
    IState
> {
    private contentRef = createRef<C>();

    public constructor(props: IProps<P, C>) {
        super(props);

        this.state = {
            title: this.props.initialOptions.title,
            actionLabel: this.props.initialOptions.actionLabel ?? _t("action|ok"),
            cancelLabel: this.props.initialOptions.cancelLabel,
            canSubmit: this.props.initialOptions.canSubmit ?? true,
        };
    }

    protected async submit(): Promise<void> {
        try {
            const model = await this.contentRef.current!.trySubmit();
            this.props.onFinished(true, model);
        } catch (e) {
            logger.error("Error during submission of module dialog:", e);
        }
    }

    protected cancel(): void {
        this.props.onFinished(false);
    }

    private setOptions(options: ModuleUiDialogOptions): void {
        this.setState((state) => ({ ...state, ...options }));
    }

    protected renderContent(): React.ReactNode {
        const dialogProps: DialogProps = {
            moduleApi: this.props.moduleApi,
            setOptions: this.setOptions.bind(this),
            cancel: this.cancel.bind(this),
        };

        // Typescript isn't very happy understanding that `contentProps` satisfies `P`
        const contentProps: P = {
            ...this.props.additionalContentProps,
            ...dialogProps,
        } as unknown as P;

        return <div className="mx_ModuleUiDialog">{this.props.contentFactory(contentProps, this.contentRef)}</div>;
    }
}
