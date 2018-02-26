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

let currentRoomId = "!JWyCNPOtOmEXOylMBv:matrix.org";

if (!global.im) {
  global.im = {};
}

export default class IntegrationManager {
  static async _init() {
    if (!global.im.client || !global.im.connected) {
      if (SdkConfig.get().integrations_ui_url && SdkConfig.get().integrations_rest_url) {
        ScalarMessaging.startListening();
        global.im.client = new ScalarAuthClient();

        await global.im.client.connect().then(() => {
          global.im.connected = true;
        }).catch((e) => {
          console.error("Failed to connect to integrations server", e);
          global.im.error = e;
        });
      } else {
        console.error('Invalid integration manager config', SdkConfig.get());
      }
    }
  }

  /**
   * Launch the integrations manager on the stickers integration page
   * @param  {string} integType integration / widget type
   * @param  {string} integId   integration / widget ID
   * @param  {function} onClose Callback to invoke on integration manager close
   */
  static async open(integType, integId, onClose) {
    await IntegrationManager._init();
    const IntegrationsManager = sdk.getComponent("views.settings.IntegrationsManager");
    console.warn("IM", global.im);
    if (global.im.error || !(global.im.client && global.im.client.hasCredentials())) {
      console.error("Scalar error", global.im);
      return;
    }
    integType = 'type_' + integType;
    console.warn("Launching integration manager", currentRoomId, integType, integId);
    const src = (global.im.client && global.im.client.hasCredentials()) ?
    global.im.client.getScalarInterfaceUrlForRoom(
      currentRoomId,
      integType,
      integId,
    ) :
    null;
    Modal.createTrackedDialog('Integrations Manager', '', IntegrationsManager, {
      src: src,
    }, "mx_IntegrationsManager");

    if (onClose) {
      onClose();
    }
  }
}
