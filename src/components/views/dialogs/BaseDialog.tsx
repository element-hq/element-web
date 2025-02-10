/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import FocusLock from "react-focus-lock";
import classNames from "classnames";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import AccessibleButton from "../elements/AccessibleButton";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import Heading from "../typography/Heading";
import { PosthogScreenTracker, type ScreenName } from "../../../PosthogTrackers";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";

interface IProps {
    // Whether the dialog should have a 'close' button that will
    // cause the dialog to be cancelled. This should only be set
    // to false if there is nothing the app can sensibly do if the
    // dialog is cancelled, eg. "We can't restore your session and
    // the app cannot work". Default: true.
    "hasCancel"?: boolean;

    // called when a key is pressed
    "onKeyDown"?: (e: KeyboardEvent | React.KeyboardEvent) => void;

    // CSS class to apply to dialog div
    "className"?: string;

    // if true, dialog container is 60% of the viewport width. Otherwise,
    // the container will have no fixed size, allowing its contents to
    // determine its size. Default: true.
    "fixedWidth"?: boolean;

    // To be displayed at the top of the dialog. Even above the title.
    "top"?: React.ReactNode;

    // Title for the dialog.
    "title"?: React.ReactNode;
    // Specific aria label to use, if not provided will set aria-labelledBy to mx_Dialog_title
    "aria-label"?: string;

    // Path to an icon to put in the header
    "headerImage"?: string;

    // children should be the content of the dialog
    "children"?: React.ReactNode;

    // Id of content element
    // If provided, this is used to add a aria-describedby attribute
    "contentId"?: string;

    // optional additional class for the title element (basically anything that can be passed to classnames)
    "titleClass"?: string | string[];

    "headerButton"?: JSX.Element;

    // optional Posthog ScreenName to supply during the lifetime of this dialog
    "screenName"?: ScreenName;
    onFinished(): void;
}

/*
 * Basic container for modal dialogs.
 *
 * Includes a div for the title, and a keypress handler which cancels the
 * dialog on escape.
 */
export default class BaseDialog extends React.Component<IProps> {
    private matrixClient: MatrixClient;

    public static defaultProps: Partial<IProps> = {
        hasCancel: true,
        fixedWidth: true,
    };

    public constructor(props: IProps) {
        super(props);

        // XXX: The contract on MatrixClientContext says it is only available within a LoggedInView subtree,
        // given that modals function outside the MatrixChat React tree this simulates that. We don't want to
        // use safeGet as it throwing would mean we cannot use modals whilst the user isn't logged in.
        // The longer term solution is to move our ModalManager into the React tree to inherit contexts properly.
        this.matrixClient = MatrixClientPeg.get()!;
    }

    private onKeyDown = (e: KeyboardEvent | React.KeyboardEvent): void => {
        this.props.onKeyDown?.(e);

        const action = getKeyBindingsManager().getAccessibilityAction(e);
        switch (action) {
            case KeyBindingAction.Escape:
                if (!this.props.hasCancel) break;

                e.stopPropagation();
                e.preventDefault();
                this.props.onFinished();
                break;
        }
    };

    private onCancelClick = (): void => {
        this.props.onFinished();
    };

    public render(): React.ReactNode {
        let cancelButton;
        if (this.props.hasCancel) {
            cancelButton = (
                <AccessibleButton
                    onClick={this.onCancelClick}
                    className="mx_Dialog_cancelButton"
                    title={_t("action|close")}
                    aria-label={_t("dialog_close_label")}
                    placement="bottom"
                />
            );
        }

        let headerImage;
        if (this.props.headerImage) {
            headerImage = <img className="mx_Dialog_titleImage" src={this.props.headerImage} alt="" />;
        }

        const lockProps: Record<string, any> = {
            "onKeyDown": this.onKeyDown,
            "role": "dialog",
            // This should point to a node describing the dialog.
            // If we were about to completely follow this recommendation we'd need to
            // make all the components relying on BaseDialog to be aware of it.
            // So instead we will use the whole content as the description.
            // Description comes first and if the content contains more text,
            // AT users can skip its presentation.
            "aria-describedby": this.props.contentId,
        };

        if (this.props["aria-label"]) {
            lockProps["aria-label"] = this.props["aria-label"];
        } else {
            lockProps["aria-labelledby"] = "mx_BaseDialog_title";
        }

        return (
            <MatrixClientContext.Provider value={this.matrixClient}>
                {this.props.screenName && <PosthogScreenTracker screenName={this.props.screenName} />}
                <FocusLock
                    returnFocus={true}
                    lockProps={lockProps}
                    className={classNames(this.props.className, {
                        mx_Dialog_fixedWidth: this.props.fixedWidth,
                    })}
                >
                    {this.props.top}
                    <div
                        className={classNames("mx_Dialog_header", {
                            mx_Dialog_headerWithButton: !!this.props.headerButton,
                        })}
                    >
                        {!!(this.props.title || headerImage) && (
                            <Heading
                                size="3"
                                as="h1"
                                className={classNames("mx_Dialog_title", this.props.titleClass)}
                                id="mx_BaseDialog_title"
                            >
                                {headerImage}
                                {this.props.title}
                            </Heading>
                        )}
                        {this.props.headerButton}
                    </div>
                    {this.props.children}
                    {cancelButton}
                </FocusLock>
            </MatrixClientContext.Provider>
        );
    }
}
