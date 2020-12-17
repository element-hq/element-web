/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import {MatrixClient} from "matrix-js-sdk/src/client";

import PlatformPeg from "../../../PlatformPeg";
import AccessibleButton from "./AccessibleButton";
import {_t} from "../../../languageHandler";
import {IIdentityProvider, ISSOFlow} from "../../../Login";
import classNames from "classnames";

interface ISSOButtonProps extends Omit<IProps, "flow"> {
    idp: IIdentityProvider;
    mini?: boolean;
}

const SSOButton: React.FC<ISSOButtonProps> = ({
    matrixClient,
    loginType,
    fragmentAfterLogin,
    idp,
    primary,
    mini,
    ...props
}) => {
    const kind = primary ? "primary" : "primary_outline";
    const label = idp ? _t("Continue with %(provider)s", { provider: idp.name }) : _t("Sign in with single sign-on");

    const onClick = () => {
        PlatformPeg.get().startSingleSignOn(matrixClient, loginType, fragmentAfterLogin, idp?.id);
    };

    let icon;
    if (typeof idp?.icon === "string" && (idp.icon.startsWith("mxc://") || idp.icon.startsWith("https://"))) {
        icon = <img
            src={matrixClient.mxcUrlToHttp(idp.icon, 24, 24, "crop", true)}
            height="24"
            width="24"
            alt={label}
        />;
    }

    const classes = classNames("mx_SSOButton", {
        mx_SSOButton_mini: mini,
    });

    if (mini) {
        // TODO fallback icon
        return (
            <AccessibleButton {...props} className={classes} kind={kind} onClick={onClick}>
                { icon }
            </AccessibleButton>
        );
    }

    return (
        <AccessibleButton {...props} className={classes} kind={kind} onClick={onClick}>
            { icon }
            { label }
        </AccessibleButton>
    );
};

interface IProps {
    matrixClient: MatrixClient;
    flow: ISSOFlow;
    loginType?: "sso" | "cas";
    fragmentAfterLogin?: string;
    primary?: boolean;
}

const SSOButtons: React.FC<IProps> = ({matrixClient, flow, loginType, fragmentAfterLogin, primary}) => {
    const providers = flow["org.matrix.msc2858.identity_providers"] || [];
    if (providers.length < 2) {
        return <div className="mx_SSOButtons">
            <SSOButton
                matrixClient={matrixClient}
                loginType={loginType}
                fragmentAfterLogin={fragmentAfterLogin}
                idp={providers[0]}
                primary={primary}
            />
        </div>;
    }

    return <div className="mx_SSOButtons">
        { providers.map(idp => (
            <SSOButton
                key={idp.id}
                matrixClient={matrixClient}
                loginType={loginType}
                fragmentAfterLogin={fragmentAfterLogin}
                idp={idp}
                mini={true}
                primary={primary}
            />
        )) }
    </div>;
};

export default SSOButtons;
