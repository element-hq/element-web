/*
Copyright 2017 New Vector Ltd

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
import SdkConfig from './SdkConfig';
import ScalarMessaging from './ScalarMessaging';
import ScalarAuthClient from './ScalarAuthClient';
import RoomViewStore from './stores/RoomViewStore';

if (!global.mxIntegrationManager) {
  global.mxIntegrationManager = {};
}

export default class IntegrationManager {
  static _init() {
    if (!global.mxIntegrationManager.client || !global.mxIntegrationManager.connected) {
      if (SdkConfig.get().integrations_ui_url && SdkConfig.get().integrations_rest_url) {
        ScalarMessaging.startListening();
        global.mxIntegrationManager.client = new ScalarAuthClient();

        return global.mxIntegrationManager.client.connect().then(() => {
          global.mxIntegrationManager.connected = true;
        }).catch((e) => {
          console.error("Failed to connect to integrations server", e);
          global.mxIntegrationManager.error = e;
        });
      } else {
        console.error('Invalid integration manager config', SdkConfig.get());
      }
    }
  }

  /**
   * Launch the integrations manager on the stickers integration page
   * @param  {string} integName integration / widget type
   * @param  {string} integId   integration / widget ID
   * @param  {function} onFinished Callback to invoke on integration manager close
   */
  static async open(integName, integId, onFinished) {
    await IntegrationManager._init();
    if (global.mxIntegrationManager.client) {
        await global.mxIntegrationManager.client.connect();
    } else {
        return;
    }
    const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
    if (global.mxIntegrationManager.error ||
        !(global.mxIntegrationManager.client && global.mxIntegrationManager.client.hasCredentials())) {
      console.error("Scalar error", global.mxIntegrationManager);
      return;
    }
    const integType = 'type_' + integName;
    const src = (global.mxIntegrationManager.client && global.mxIntegrationManager.client.hasCredentials()) ?
      global.mxIntegrationManager.client.getScalarInterfaceUrlForRoom(
        {roomId: RoomViewStore.getRoomId()},
        integType,
        integId,
      ) :
      null;
    Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, {
      src: src,
      onFinished: onFinished,
    }, "mx_IntegrationsManager");
  }
}
