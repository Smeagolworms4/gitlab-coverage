(() => {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('js/gitlab.js')
    document.body.appendChild(s);
})();