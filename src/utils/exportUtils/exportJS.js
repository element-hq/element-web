function showToastIfNeeded(replyId) {
    const el = document.getElementById(replyId);
    if (!el) {
        showToast("The message you're looking for wasn't exported");
        return;
    }
}

function showToast(text) {
    const el = document.getElementById("snackbar");
    el.innerHTML = text;
    el.className = "mx_show";
    setTimeout(() => {
        el.className = el.className.replace("mx_show", "");
    }, 2000);
}

window.onload = () => {
    document.querySelectorAll('.mx_reply_anchor').forEach(element => {
        element.addEventListener('click', event => {
            showToastIfNeeded(event.target.getAttribute("scroll-to"));
        });
    });
};

