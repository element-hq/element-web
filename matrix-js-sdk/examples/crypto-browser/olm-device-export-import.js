if (!Olm) {
    console.error(
        "global.Olm does not seem to be present."
        + " Did you forget to add olm in the lib/ directory?"
    );
}

const BASE_URL = 'http://localhost:8008';
const ROOM_CRYPTO_CONFIG = { algorithm: 'm.megolm.v1.aes-sha2' };
const PASSWORD = 'password';

// useful to create new usernames
window.randomHex = () => Math.floor(Math.random() * (10**6)).toString(16);

window.newMatrixClient = async function (username) {
    const registrationClient = matrixcs.createClient(BASE_URL);

    const userRegisterResult = await registrationClient.register(
      username,
      PASSWORD,
      null,
      { type: 'm.login.dummy' }
    );
  
    const matrixClient = matrixcs.createClient({
      baseUrl: BASE_URL,
      userId: userRegisterResult.user_id,
      accessToken: userRegisterResult.access_token,
      deviceId: userRegisterResult.device_id,
      sessionStore: new matrixcs.WebStorageSessionStore(window.localStorage),
      cryptoStore: new matrixcs.MemoryCryptoStore(),
    });

    extendMatrixClient(matrixClient);

    await matrixClient.initCrypto();
    await matrixClient.startClient();
    return matrixClient;
}

window.importMatrixClient = async function (exportedDevice, accessToken) {
    const matrixClient = matrixcs.createClient({
      baseUrl: BASE_URL,
      deviceToImport: exportedDevice,
      accessToken,
      sessionStore: new matrixcs.WebStorageSessionStore(window.localStorage),
      cryptoStore: new matrixcs.MemoryCryptoStore(),
    });

    extendMatrixClient(matrixClient);

    await matrixClient.initCrypto();
    await matrixClient.startClient();
    return matrixClient;
}

function extendMatrixClient(matrixClient) {
    // automatic join
    matrixClient.on('RoomMember.membership', async (event, member) => {
        if (member.membership === 'invite' && member.userId === matrixClient.getUserId()) {
            await matrixClient.joinRoom(member.roomId);
            // setting up of room encryption seems to be triggered automatically
            // but if we don't wait for it the first messages we send are unencrypted
            await matrixClient.setRoomEncryption(member.roomId, { algorithm: 'm.megolm.v1.aes-sha2' })
        }
    });

    matrixClient.onDecryptedMessage = message => {
        console.log('Got encrypted message: ', message);
    }

    matrixClient.on('Event.decrypted', (event) => {
        if (event.getType() === 'm.room.message'){
            matrixClient.onDecryptedMessage(event.getContent().body);
        } else {
            console.log('decrypted an event of type', event.getType());
            console.log(event);
        }
    });
  
    matrixClient.createEncryptedRoom = async function(usersToInvite) {
        const {
          room_id: roomId,
        } = await this.createRoom({
          visibility: 'private',
          invite: usersToInvite,
        });

        // matrixClient.setRoomEncryption() only updates local state
        // but does not send anything to the server
        // (see https://github.com/matrix-org/matrix-js-sdk/issues/905)
        // so we do it ourselves with 'sendStateEvent'
        await this.sendStateEvent(
          roomId, 'm.room.encryption', ROOM_CRYPTO_CONFIG,
        );
        await this.setRoomEncryption(
          roomId, ROOM_CRYPTO_CONFIG,
        );

        // Marking all devices as verified
        let room = this.getRoom(roomId);
        let members = (await room.getEncryptionTargetMembers()).map(x => x["userId"])
        let memberkeys = await this.downloadKeys(members);
        for (const userId in memberkeys) {
          for (const deviceId in memberkeys[userId]) {
            await this.setDeviceVerified(userId, deviceId);
          }
        }

        return roomId;
    }

    matrixClient.sendTextMessage = async function(message, roomId) {
        return matrixClient.sendMessage(
            roomId,
            {
                body: message,
                msgtype: 'm.text',
            }
        )
    }
}