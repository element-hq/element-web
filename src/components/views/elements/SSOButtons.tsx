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
import { chunk } from "lodash";
import classNames from "classnames";
import {MatrixClient} from "matrix-js-sdk/src/client";

import PlatformPeg from "../../../PlatformPeg";
import AccessibleButton from "./AccessibleButton";
import {_t} from "../../../languageHandler";
import {IdentityProviderBrand, IIdentityProvider, ISSOFlow} from "../../../Login";
import AccessibleTooltipButton from "./AccessibleTooltipButton";
import {mediaFromMxc} from "../../../customisations/Media";

interface ISSOButtonProps extends Omit<IProps, "flow"> {
    idp: IIdentityProvider;
    mini?: boolean;
}

const getIcon = (brand: IdentityProviderBrand | string) => {
    switch (brand) {
        case IdentityProviderBrand.Apple:
            return require(`../../../../res/img/element-icons/brands/apple.svg`);
        case IdentityProviderBrand.Facebook:
            return require(`../../../../res/img/element-icons/brands/facebook.svg`);
        case IdentityProviderBrand.Github:
            return require(`../../../../res/img/element-icons/brands/github.svg`);
        case IdentityProviderBrand.Gitlab:
            return require(`../../../../res/img/element-icons/brands/gitlab.svg`);
        case IdentityProviderBrand.Google:
            return require(`../../../../res/img/element-icons/brands/google.svg`);
        case IdentityProviderBrand.Twitter:
            return require(`../../../../res/img/element-icons/brands/twitter.svg`);
        default:
            return null;
    }
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
    const label = idp ? _t("Continue with %(provider)s", { provider: idp.name }) : _t("Sign in with single sign-on");

    const onClick = () => {
        PlatformPeg.get().startSingleSignOn(matrixClient, loginType, fragmentAfterLogin, idp?.id);
    };

    let icon;
    let brandClass;
    const brandIcon = idp ? getIcon(idp.brand) : null;
    if (brandIcon) {
        const brandName = idp.brand.split(".").pop();
        brandClass = `mx_SSOButton_brand_${brandName}`;
        icon = <img src={brandIcon} height="24" width="24" alt={brandName} />;
    } else if (typeof idp?.icon === "string" && idp.icon.startsWith("mxc://")) {
        const src = mediaFromMxc(idp.icon, matrixClient).getSquareThumbnailHttp(24);
        icon = <img src={src} height="24" width="24" alt={idp.name} />;
    }

    const classes = classNames("mx_SSOButton", {
        [brandClass]: brandClass,
        mx_SSOButton_mini: mini,
        mx_SSOButton_default: !idp,
        mx_SSOButton_primary: primary,
    });

    if (mini) {
        // TODO fallback icon
        return (
            <AccessibleTooltipButton {...props} title={label} className={classes} onClick={onClick}>
                { icon }
            </AccessibleTooltipButton>
        );
    }

    return (
        <AccessibleButton {...props} className={classes} onClick={onClick}>
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

const MAX_PER_ROW = 6;

const SSOButtons: React.FC<IProps> = ({matrixClient, flow, loginType, fragmentAfterLogin, primary}) => {
    const providers = flow.identity_providers || [];
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

    const rows = Math.ceil(providers.length / MAX_PER_ROW);
    const size = Math.ceil(providers.length / rows);

    return <div className="mx_SSOButtons">
        { chunk(providers, size).map(chunk => (
            <div key={chunk[0].id} className="mx_SSOButtons_row">
                { chunk.map(idp => (
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
            </div>
        )) }
    </div>;
};

export default SSOButtons;
