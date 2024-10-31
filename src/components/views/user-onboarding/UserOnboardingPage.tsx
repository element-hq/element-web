/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import * as React from "react";

import { useInitialSyncComplete } from "../../../hooks/useIsInitialSyncComplete";
import { useSettingValue } from "../../../hooks/useSettings";
import { useUserOnboardingContext } from "../../../hooks/useUserOnboardingContext";
import { useUserOnboardingTasks } from "../../../hooks/useUserOnboardingTasks";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import SdkConfig from "../../../SdkConfig";
import { UseCase } from "../../../settings/enums/UseCase";
import { getHomePageUrl } from "../../../utils/pages";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import EmbeddedPage from "../../structures/EmbeddedPage";
import HomePage from "../../structures/HomePage";
import { UserOnboardingHeader } from "./UserOnboardingHeader";
import { UserOnboardingList } from "./UserOnboardingList";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

interface Props {
    justRegistered?: boolean;
}

// We decided to only show the new user onboarding page to new users
// For now, that means we set the cutoff at 2022-07-01 00:00 UTC
const USER_ONBOARDING_CUTOFF_DATE = new Date(1_656_633_600);
export function showUserOnboardingPage(useCase: UseCase | null): boolean {
    return useCase !== null || MatrixClientPeg.userRegisteredAfter(USER_ONBOARDING_CUTOFF_DATE);
}

const ANIMATION_DURATION = 2800;
export function UserOnboardingPage({ justRegistered = false }: Props): JSX.Element {
    const cli = useMatrixClientContext();
    const config = SdkConfig.get();
    const pageUrl = getHomePageUrl(config, cli);

    const useCase = useSettingValue<UseCase | null>("FTUE.useCaseSelection");
    const context = useUserOnboardingContext();
    const tasks = useUserOnboardingTasks(context);

    const initialSyncComplete = useInitialSyncComplete();
    const [showList, setShowList] = useState<boolean>(false);
    useEffect(() => {
        if (initialSyncComplete) {
            const handler = window.setTimeout(() => {
                setShowList(true);
            }, ANIMATION_DURATION);
            return () => {
                clearTimeout(handler);
            };
        } else {
            setShowList(false);
        }
    }, [initialSyncComplete, setShowList]);

    // Only show new onboarding list to users who registered after a given date or have chosen a use case
    if (!showUserOnboardingPage(useCase)) {
        return <HomePage justRegistered={justRegistered} />;
    }

    if (pageUrl) {
        return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar={true} />;
    }

    return (
        <AutoHideScrollbar className="mx_UserOnboardingPage">
            <UserOnboardingHeader useCase={useCase} />
            {showList && <UserOnboardingList tasks={tasks} />}
        </AutoHideScrollbar>
    );
}
