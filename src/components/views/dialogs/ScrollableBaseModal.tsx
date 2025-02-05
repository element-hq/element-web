/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FormEvent } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import FocusLock from "react-focus-lock";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";

export interface IScrollableBaseState {
    canSubmit: boolean;
    title: string;
    actionLabel: string;
    cancelLabel?: string;
}

/**
 * Scrollable dialog base from Compound (Web Components).
 */
export default abstract class ScrollableBaseModal<
    TProps extends { onFinished?: (...args: any[]) => void },
    TState extends IScrollableBaseState,
> extends React.PureComponent<TProps, TState> {
    protected constructor(props: TProps) {
        super(props);
    }

    protected get matrixClient(): MatrixClient {
        // XXX: The contract on MatrixClientContext says it is only available within a LoggedInView subtree,
        // given that modals function outside the MatrixChat React tree this simulates that. We don't want to
        // use safeGet as it throwing would mean we cannot use modals whilst the user isn't logged in.
        // The longer term solution is to move our ModalManager into the React tree to inherit contexts properly.
        return MatrixClientPeg.get()!;
    }

    private onKeyDown = (e: KeyboardEvent | React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(e);
        switch (action) {
            case KeyBindingAction.Escape:
                e.stopPropagation();
                e.preventDefault();
                this.cancel();
                break;
        }
    };

    private onCancel = (): void => {
        this.cancel();
    };

    private onSubmit = (e: MouseEvent | FormEvent): void => {
        e.stopPropagation();
        e.preventDefault();
        if (!this.state.canSubmit) return; // pretend the submit button was disabled
        this.submit();
    };

    protected abstract cancel(): void;
    protected abstract submit(): void;
    protected abstract renderContent(): React.ReactNode;

    public render(): React.ReactNode {
        return (
            <MatrixClientContext.Provider value={this.matrixClient}>
                <FocusLock
                    returnFocus={true}
                    lockProps={{
                        onKeyDown: this.onKeyDown,
                        role: "dialog",
                        ["aria-labelledby"]: "mx_CompoundDialog_title",

                        // Like BaseDialog, we'll just point this at the whole content
                        ["aria-describedby"]: "mx_CompoundDialog_content",
                    }}
                    className="mx_CompoundDialog mx_ScrollableBaseDialog"
                >
                    <div className="mx_CompoundDialog_header">
                        <h1>{this.state.title}</h1>
                    </div>
                    <AccessibleButton
                        onClick={this.onCancel}
                        className="mx_CompoundDialog_cancelButton"
                        aria-label={_t("dialog_close_label")}
                    />
                    <form onSubmit={this.onSubmit} className="mx_CompoundDialog_form">
                        <div className="mx_CompoundDialog_content">{this.renderContent()}</div>
                        <div className="mx_CompoundDialog_footer">
                            <AccessibleButton onClick={this.onCancel} kind="primary_outline">
                                {this.state.cancelLabel ?? _t("action|cancel")}
                            </AccessibleButton>
                            <AccessibleButton
                                onClick={this.onSubmit}
                                kind="primary"
                                disabled={!this.state.canSubmit}
                                type="submit"
                                element="button"
                                className="mx_Dialog_nonDialogButton"
                            >
                                {this.state.actionLabel}
                            </AccessibleButton>
                        </div>
                    </form>
                </FocusLock>
            </MatrixClientContext.Provider>
        );
    }
}
