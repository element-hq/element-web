/*
Copyright 2018 New Vector Ltd

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

import React from 'react';
import QuestionDialog from './QuestionDialog';
import { _t } from '../../../languageHandler';

export default (props) => {
    const description1 =
        _t("You've previously used Riot on %(host)s with lazy loading of members enabled. " +
            "In this version lazy loading is disabled. " +
            "As the local cache is not compatible between these two settings, " +
            "Riot needs to resync your account.",
            {host: props.host});
    const description2 = _t("If the other version of Riot is still open in another tab, " +
            "please close it as using Riot on the same host with both " +
            "lazy loading enabled and disabled simultaneously will cause issues.");

    return (<QuestionDialog
        hasCancelButton={false}
        title={_t("Incompatible local cache")}
        description={<div><p>{description1}</p><p>{description2}</p></div>}
        button={_t("Clear cache and resync")}
        onFinished={props.onFinished}
    />);
};
