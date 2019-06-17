/*
Copyright 2017 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import Modal from './Modal';
import sdk from './index';
import RoomViewStore from './stores/RoomViewStore';
import MatrixClientPeg from "./MatrixClientPeg";

// TODO: We should use this everywhere.
export default class IntegrationManager {
    /**
     * Launch the integrations manager on the specified integration page
     * @param  {string} integName integration / widget type
     * @param  {string} integId   integration / widget ID
     * @param  {function} onFinished Callback to invoke on integration manager close
     */
    static async open(integName, integId, onFinished) {
        // The dialog will take care of scalar auth for us
        const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
        Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, {
            room: MatrixClientPeg.get().getRoom(RoomViewStore.getRoomId()),
            screen: 'type_' + integName,
            integrationId: integId,
            onFinished: onFinished,
        }, "mx_IntegrationsManager");
    }
}
