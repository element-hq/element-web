console.log("Loading browser sdk");

var client = matrixcs.createClient("https://matrix.org");
client.publicRooms(function (err, data) {
    if (err) {
	   console.error("err %s", JSON.stringify(err));
       return;
    }
    console.log("data %s [...]", JSON.stringify(data).substring(0, 100));
    console.log("Congratulations! The SDK is working on the browser!");
    var result = document.getElementById("result");
    result.innerHTML = "<p>The SDK appears to be working correctly.</p>";
});
