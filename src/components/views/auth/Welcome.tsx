/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect, useState } from "react";
import classNames from "classnames";
import { LogIn, UserPlus, Compass } from "lucide-react";

import AuthPage from "./AuthPage";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { _t } from "../../../languageHandler";
import { Button } from "../../ui/Button";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import dis from "../../../dispatcher/dispatcher";
import { type ActionPayload } from "../../../dispatcher/payloads";
import { Action } from "../../../dispatcher/actions";

const Welcome: React.FC = () => {
    const matrixClientContext = useContext(MatrixClientContext);
    const [, setClientReady] = useState(false);

    useEffect(() => {
        const onAction = (payload: ActionPayload): void => {
            // HACK: Workaround for the context's MatrixClient not being set up at render time.
            if (payload.action === Action.ClientStarted) {
                setClientReady(true);
            }
        };

        const dispatcherRef = dis.register(onAction);

        return () => {
            dis.unregister(dispatcherRef);
        };
    }, []);

    const showRegistration = SettingsStore.getValue(UIFeature.Registration);

    const client = matrixClientContext || MatrixClientPeg.get();
    const isGuest = client ? client.isGuest() : true;
    const showExploreRooms = !!client;

    return (
        <AuthPage>
            <div
                className={classNames("mx_Welcome", {
                    mx_WelcomePage_registrationDisabled: !showRegistration,
                })}
                data-testid="mx_welcome_screen"
            >
                <div
                    className={classNames("mx_WelcomePage", {
                        mx_WelcomePage_guest: isGuest,
                        mx_WelcomePage_loggedIn: !!client,
                    })}
                >
                    <div className="mx_WelcomePage_body flex flex-col items-center justify-center p-6 text-center">
                        <h1 className="text-2xl font-semibold mt-5 mb-2">{_t("welcome_to_clap")}</h1>

                        <div className="flex flex-col gap-3 mt-6 w-full max-w-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Button asChild className="gap-2">
                                    <a href="#/login" className="text-white! no-underline">
                                        <LogIn className="h-4 w-4" />
                                        {_t("action|sign_in")}
                                    </a>
                                </Button>

                                {showRegistration && (
                                    <Button asChild variant="outline" className="gap-2">
                                        <a href="#/register" className="text-inherit! no-underline">
                                            <UserPlus className="h-4 w-4" />
                                            {_t("action|create_account")}
                                        </a>
                                    </Button>
                                )}
                            </div>

                            {showExploreRooms && (
                                <div className="mx_WelcomePage_guestFunctions mt-4">
                                    <Button asChild variant="outline" className="w-full gap-2">
                                        <a href="#/directory">
                                            <Compass className="h-4 w-4" />
                                            {_t("action|explore_rooms")}
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthPage>
    );
};

export default Welcome;
