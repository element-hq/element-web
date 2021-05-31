export default `
function scrollToElement(replyId){
    let el = document.getElementById(replyId);
    if(!el) { 
        showToast("The message you're looking for wasn't exported");
        return;
    };
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.backgroundColor = '#f6f7f8';
    el.style.transition = 'background-color 1s ease'
    setTimeout(() => {
        el.style.backgroundColor = "white"
    }, 2000);
}

function showToast(text) {
  let el = document.getElementById("snackbar");
  el.innerHTML = text;
  el.className = "mx_show";
  setTimeout(() => {
      el.className = el.className.replace("mx_show", "");
  }, 2000);
}

window.onload = () => {
  document.querySelectorAll('.mx_reply_anchor').forEach(element => {
    element.addEventListener('click', event => {
      scrollToElement(event.target.getAttribute("scroll-to"));
    })
  })
}
`
