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

import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import AutoHideScrollbar from "matrix-react-sdk/src/components/structures/AutoHideScrollbar";
import EmbeddedPage from "matrix-react-sdk/src/components/structures/EmbeddedPage";
import { useMatrixClientContext } from "matrix-react-sdk/src/contexts/MatrixClientContext";
import { getHomePageUrl } from "matrix-react-sdk/src/utils/pages";
import { useUserOnboardingTasks } from "matrix-react-sdk/src/hooks/useUserOnboardingTasks";
import { UserOnboardingList } from "matrix-react-sdk/src/components/views/user-onboarding/UserOnboardingList";
import { useUserOnboardingContext } from "matrix-react-sdk/src/hooks/useUserOnboardingContext";
import * as React from "react";

import { UserOnboardingHeader } from "../views/user-onboarding/UserOnboardingHeader";

interface IProps {
    justRegistered?: boolean;
}

const HomePage: React.FC<IProps> = () => {
    const cli = useMatrixClientContext();
    const config: any = SdkConfig.get();
    const pageUrl = getHomePageUrl(config, cli);

    const context = useUserOnboardingContext();
    const tasks = useUserOnboardingTasks(context);

    if (pageUrl) {
        return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar={true} />;
    }

    return (
        <AutoHideScrollbar className="mx_UserOnboardingPage" style={{ maxWidth: "100%" }}>
            <div className="container">
                <UserOnboardingHeader />
                <UserOnboardingList tasks={tasks} />
            </div>
        </AutoHideScrollbar>
    );
};

export default HomePage;
