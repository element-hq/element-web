/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import AuthFooter from "./AuthFooter";

interface IProps {
    /**
     * Whether to add a blurred shadow around the modal.
     *
     * If the modal component provides its own shadow or blurring, this can be
     * disabled.  Defaults to `true`.
     */
    addBlur?: boolean;
    disableLanguageSelector?: boolean;
}

export default class AuthPage extends React.PureComponent<React.PropsWithChildren<IProps>> {
    public render(): React.ReactElement {
        const pageStyle = {};

        const modalStyle: React.CSSProperties = {
            position: "relative",
            background: "initial",
            // borderRadius: "16px",
            overflow: "hidden",
            // border: "1px solid rgb(229, 231, 235)",
            // boxShadow: "rgba(34, 42, 53, 0.05) 0px 4px 8px 0px",
        };

        const blurStyle: React.CSSProperties = {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            filter: "blur(40px)",
        };

        const modalContentStyle: React.CSSProperties = {
            display: "flex",
            zIndex: 1,
            borderRadius: "12px",
        };

        let modalBlur;
        if (this.props.addBlur !== false) {
            // Blur out the background: add a `div` which covers the content behind the modal,
            // and blurs it out.
            modalBlur = <div className="mx_AuthPage_modalBlur" style={blurStyle} />;
        }

        const modalClasses = classNames({
            mx_AuthPage_modal: true,
            mx_AuthPage_modal_withBlur: this.props.addBlur !== false,
        });

        return (
            <div className="mx_AuthPage" style={pageStyle}>
                <div className={modalClasses} style={modalStyle}>
                    {modalBlur}
                    <main
                        className="mx_AuthPage_modalContent"
                        style={modalContentStyle}
                        tabIndex={-1}
                        aria-live="polite"
                    >
                        {this.props.children}
                    </main>
                </div>
                <AuthFooter disableLanguageSelector={this.props.disableLanguageSelector} />
            </div>
        );
    }
}
