console.log("Loading browser sdk");
const BASE_URL = "https://matrix.org";
const TOKEN = "accesstokengoeshere";
const USER_ID = "@username:localhost";
const ROOM_ID = "!room:id";
const DEVICE_ID = "some_device_id";

const client = matrixcs.createClient({
    baseUrl: BASE_URL,
    accessToken: TOKEN,
    userId: USER_ID,
    deviceId: DEVICE_ID
});
let call;

function disableButtons(place, answer, hangup) {
    document.getElementById("hangup").disabled = hangup;
    document.getElementById("answer").disabled = answer;
    document.getElementById("call").disabled = place;
}

function addListeners(call) {
    let lastError = "";
    call.on("hangup", function() {
        disableButtons(false, true, true);
        document.getElementById("result").innerHTML = (
            "<p>Call ended. Last error: "+lastError+"</p>"
        );
    });
    call.on("error", function(err) {
        lastError = err.message;
        call.hangup();
        disableButtons(false, true, true);
    });
    call.on("feeds_changed", function(feeds) {
        const localFeed = feeds.find((feed) => feed.isLocal());
        const remoteFeed = feeds.find((feed) => !feed.isLocal());

        const remoteElement = document.getElementById("remote");
        const localElement = document.getElementById("local");

        if (remoteFeed) {
            remoteElement.srcObject = remoteFeed.stream;
            remoteElement.play();
        }
        if (localFeed) {
            localElement.muted = true;
            localElement.srcObject = localFeed.stream;
            localElement.play();
        }
    });
}

window.onload = function() {
    document.getElementById("result").innerHTML = "<p>Please wait. Syncing...</p>";
    document.getElementById("config").innerHTML = "<p>" +
        "Homeserver: <code>"+BASE_URL+"</code><br/>"+
        "Room: <code>"+ROOM_ID+"</code><br/>"+
        "User: <code>"+USER_ID+"</code><br/>"+
        "</p>";
    disableButtons(true, true, true);
};

client.on("sync", function(state, prevState, data) {
    switch (state) {
        case "PREPARED":
          syncComplete();
        break;
   }
});

function syncComplete() {
    document.getElementById("result").innerHTML = "<p>Ready for calls.</p>";
    disableButtons(false, true, true);

    document.getElementById("call").onclick = function() {
        console.log("Placing call...");
        call = matrixcs.createNewMatrixCall(
            client, ROOM_ID
        );
        console.log("Call => %s", call);
        addListeners(call);
        call.placeVideoCall();
        document.getElementById("result").innerHTML = "<p>Placed call.</p>";
        disableButtons(true, true, false);
    };

    document.getElementById("hangup").onclick = function() {
        console.log("Hanging up call...");
        console.log("Call => %s", call);
        call.hangup();
        document.getElementById("result").innerHTML = "<p>Hungup call.</p>";
    };

    document.getElementById("answer").onclick = function() {
        console.log("Answering call...");
        console.log("Call => %s", call);
        call.answer();
        disableButtons(true, true, false);
        document.getElementById("result").innerHTML = "<p>Answered call.</p>";
    };

    client.on("Call.incoming", function(c) {
        console.log("Call ringing");
        disableButtons(true, false, false);
        document.getElementById("result").innerHTML = "<p>Incoming call...</p>";
        call = c;
        addListeners(call);
    });
}
client.startClient();
