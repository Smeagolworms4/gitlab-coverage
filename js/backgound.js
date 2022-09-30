const fetchCobertura = async(message, sendResponse) => {
    try {
        console.log(message.cookie);
        const r = await fetch(message.url, {
            headers: {
                cookie: message.cookie
            }
        });
        const body = await r.body;
         
        const decompressedReadableStream = body.pipeThrough(
             new DecompressionStream('gzip')
        );
        let buffer = new Uint8Array(0);
        const reader = decompressedReadableStream.getReader();
        while (true) { // eslint-disable-line no-constant-condition
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const newResult = new Uint8Array(buffer.length + value.length);
            newResult.set(buffer);
            newResult.set(value, buffer.length);
            buffer = newResult;
        }
        const text = new TextDecoder().decode(buffer);
        
        sendResponse({
            type: 'gitlab-coverage-fetch-cobertura-ack',
            id: message.id,
            success: true,
            message: text
        });
                    
        
    } catch(e) {
        console.warn('Error on fetch:', e);
        sendResponse({
            type: 'gitlab-coverage-fetch-cobertura-ack',
            id: message.id,
            success: false,
            error: e
        });
    }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    if (message.type === 'gitlab-coverage-fetch-cobertura') {
        
        fetchCobertura(message, sendResponse);
        
        return true;
    }
});