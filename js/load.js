(() => {
    
    window.addEventListener('message', async (message) => {
        if (message.data.type === 'gitlab-coverage-fetch-cobertura') {
            chrome.runtime.sendMessage(message.data, function(response) {
                window.postMessage(response);
            });
        }
    });
    
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('js/gitlab.js');
    document.body.appendChild(s);
    
})();


