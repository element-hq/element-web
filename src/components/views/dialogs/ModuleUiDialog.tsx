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

import React, { createRef } from "react";
import { DialogContent, DialogProps } from "@matrix-org/react-sdk-module-api/lib/components/DialogContent";
import { logger } from "matrix-js-sdk/src/logger";

import ScrollableBaseModal, { IScrollableBaseState } from "./ScrollableBaseModal";
import { _t } from "../../../languageHandler";

interface IProps<C extends React.Component = React.Component> {
    contentFactory: (props: DialogProps, ref: React.Ref<C>) => React.ReactNode;
    contentProps: DialogProps;
    title: string;
    onFinished(ok?: boolean, model?: Awaited<ReturnType<DialogContent["trySubmit"]>>): void;
}

interface IState extends IScrollableBaseState {
    // nothing special
}

export class ModuleUiDialog extends ScrollableBaseModal<IProps, IState> {
    private contentRef = createRef<DialogContent>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            title: this.props.title,
            canSubmit: true,
            actionLabel: _t("OK"),
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

    protected renderContent(): React.ReactNode {
        return (
            <div className="mx_ModuleUiDialog">
                {this.props.contentFactory(this.props.contentProps, this.contentRef)}
            </div>
        );
    }
}
